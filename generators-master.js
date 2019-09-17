//generators-master.js
//Implementation-specific wrapper around instances of BrickGenerator/StagedBrickGenerator.
//Stores bricks from BrickGenerator in a master list and passes a combined mesh to a ThreeJS previewer (previewer.js).
//TODO ongoing: May have some hardcoded hooks in generators; remove those whenever possible
//TODO: model2brick? minimization will probably be even more of a nightmare than with images

var Generators = {};
var GeneratorNames = [];
var currGen = false;

var MASTER_BRICK_LIMIT = 100000;

//max brickadia brick size before it crashes = 2048 units (in any direction?), 1x1f = 10x10x4 units
//TODO: for now these are softcaps in the BLS writer (bricks are resized) instead of hardcaps in the engine (stops generation), StagedBrickGenerator external halting in general needs some work
var MASTER_SX_LIMIT = 204;
var MASTER_SY_LIMIT = 204;
var MASTER_SZ_LIMIT = 511; //can this be 512?

var BrickList;

var ClearBrickList = function() {
	BrickList = [];
	BrickList = new Proxy(BrickList, {
		set: function(target,property,value,receiver) {
			target[property] = value;
			$("#label-brickcount").text(BrickList.length + " bricks in memory");
			return true;
		}
	});
	$("#label-brickcount").text("0 bricks in memory");
	$("#label-bounds").text("Size: N/A");
	$("#label-cog").text("CoG: N/A");
}
ClearBrickList();



//batch disable/enable for UI that may cause problems if used while generation is active
//TODO: change the generate button to (or slide-swap it with to be fancy) a cancel button
//		or add cancel buttons on status tickets?
var GenDisable = function() {
	$("#btn-generate").prop("disabled", true);
	$("#btn-bake").prop("disabled", true);
	$("#btn-shift").prop("disabled", true);
	$("#btn-clear").prop("disabled", true);
	$("#generator-type").prop("disabled", true);
}
var GenEnable = function() {
	$("#btn-generate").prop("disabled", false);
	$("#btn-bake").prop("disabled", false);
	$("#btn-shift").prop("disabled", false);
	$("#btn-clear").prop("disabled", false);
	$("#generator-type").prop("disabled", false);
}



/*//////////////////////////////
//Mesh baking for previewer.js//
//////////////////////////////*/

//referenced in previewer.js; main render object for all bricks
var GenGeometry = new THREE.Geometry();
var GenMaterial = new THREE.MeshToonMaterial({vertexColors: THREE.FaceColors});
var GenMesh = new THREE.Mesh(GenGeometry, GenMaterial);
GenMesh.frustumCulled = false;
PvwScene.add(GenMesh);

var EmptyGeometry = new THREE.PlaneGeometry();

//because memory leaks... which are NOT fixed by https://github.com/mrdoob/three.js/pull/12464 even though it sounds like they should be
//prior approach (destroying the mesh object and building an entirely new one) was also very leaky, manually clearing the existing one out like this seems like the only good solution for now
var NukeGeometry = function() {
	//clear our own geometry cache
	//clear ABSOLUTELY EVERYTHING in the main geometry object just in case we use any of it later and forget about this bug
	GenGeometry.colors = [];
	GenGeometry.faceVertexUvs = [];
	GenGeometry.faces = [];
	GenGeometry.lineDistances = [];
	GenGeometry.morphNormals = [];
	GenGeometry.morphTargets = [];
	GenGeometry.skinIndices = [];
	GenGeometry.skinWeights = [];
	GenGeometry.vertices = [];
	//trick threejs into clearing its super-duper-persistent _bufferGeometry by merging a near-empty geometry
	GenGeometry.merge(EmptyGeometry);
	//mark everything for update, then immediately render a frame to force threejs to process those updates
	ForceUpdateGeometry();
	//now clear the near-empty. end result is that only those buffers (a whole 6 verts!) are in memory, and nothing is rendered
	GenGeometry.vertices = [];
	GenGeometry.colors = [];
	GenGeometry.faceVertexUvs = [];
	GenGeometry.faces = [];
	//mark-and-update once more
	ForceUpdateGeometry();
}
var ForceUpdateGeometry = function() {
	GenGeometry.colorsNeedUpdate = true;
	GenGeometry.elementsNeedUpdate = true;
	GenGeometry.groupsNeedUpdate = true;
	GenGeometry.lineDistancesNeedUpdate = true;
	GenGeometry.normalsNeedUpdate = true;
	GenGeometry.uvsNeedUpdate = true;
	GenGeometry.verticesNeedUpdate = true;
	GenGeometry.computeBoundingSphere();
	PvwRenderer.render(PvwScene, PvwCamera);
}

//squishing all these bricks together is slow, so use a slowiterator to avoid locking the UI thread
var SBG_SI_MeshBaker = new SBG_SlowIterator(function(inst) {
	var currBrick = inst.bricks[inst.currI];
	var ngm = GetSimpleBrickGeom(currBrick.BoundingBox);
	
	for(var j = 0; j < ngm.faces.length; j++) {
		ngm.faces[j].color = currBrick.Color;
	}
	
	var tmtx = new THREE.Matrix4();
	tmtx.multiply(new THREE.Matrix4().makeTranslation(currBrick.Position.x, currBrick.Position.y, currBrick.Position.z/3));
	tmtx.multiply(new THREE.Matrix4().makeTranslation(currBrick.BoundingBox.x/2, currBrick.BoundingBox.y/2, currBrick.BoundingBox.z/6));
	tmtx.multiply(new THREE.Matrix4().makeRotationZ(currBrick.RotationIndex*3.14159265/2));
	GenGeometry.merge(ngm, tmtx);
	
	inst.currI ++;
	return inst.currI == inst.maxI;
},{
	RunSpeed: 50,
	MaxExecTime: 40,
	TEST_GateByTime: true,
	OnStageSetup: function(inst) {
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
		if(inst.maxI == 0) inst.abort = "No bricks to bake";
		SimpleBrickGeom = [];
	},
	OnStagePause: function(inst) {
		return "Baking mesh... " + Math.floor(inst.currI/inst.maxI*100) + "%";
	}
})

var GenGeoStatus;
var GenGeoRebuild = function() {
	GenDisable();
	NukeGeometry();
	GenGeoStatus = new StatusTicket($("#status-container"), {initText: "Baking mesh..."});
	var rprm = $.Deferred();
	SBG_SI_MeshBaker.apply({bricks: BrickList, _statusEnabled: true, _statusContainer: $("#status-container"), _ticket: GenGeoStatus}, rprm); //TODO: make a function for easier standalone use of stages like this, add an onDone callback?
	$.when(rprm).done(function() {
		GenGeoStatus.close();
		GenGeoStatus = undefined;
		
		ForceUpdateGeometry();
		
		GenGeometry.computeBoundingBox();
		var nsz = new THREE.Vector3();
		GenGeometry.boundingBox.getSize(nsz);
		var nzwhole = nsz.z.toFixed(0);
		var nzflat = ((nsz.z - nzwhole)*3).toFixed(0);
		if(nzflat == "-0" || nzflat == "0") {
			$("#label-bounds").text("Size: " + nsz.x.toFixed(0) + "x" + nsz.y.toFixed(0) + "x" + nzwhole);
		} else {
			$("#label-bounds").text("Size: " + nsz.x.toFixed(0) + "x" + nsz.y.toFixed(0) + "x(" + nzwhole + "+" + nzflat + "f)");
		}
		GenGeometry.boundingBox.getCenter(nsz);
		$("#label-cog").text("CoG: " + nsz.x.toFixed(1) + ", " + nsz.y.toFixed(1) + ", " + nsz.z.toFixed(1));
		
		if(!$("#opt-livepreview").is(':checked'))
			PvwRenderer.render(PvwScene, PvwCamera);
		
		GenEnable();
	});
}

var BevelRadius = 0.02;
var GenerateSimpleBrick = function(i, j, k) {
	//if($("#opt-simplebricks").get(0).checked) {
	return new THREE.BoxGeometry(i-BevelRadius, j-BevelRadius, k/3-BevelRadius).translate(BevelRadius/2,BevelRadius/2,BevelRadius/2);
	/*} else {
		var shape = new THREE.Shape();
		shape.moveTo(0,BevelRadius);
		shape.lineTo(BevelRadius,0);
		shape.lineTo(i-BevelRadius,0);
		shape.lineTo(i,BevelRadius);
		shape.lineTo(i,j-BevelRadius);
		shape.lineTo(i-BevelRadius,j);
		shape.lineTo(BevelRadius,j);
		shape.lineTo(0,j-BevelRadius);
		shape.lineTo(0,BevelRadius);
		var RGeom = new THREE.ExtrudeGeometry(shape, {
			steps: 1,
			depth: k / 3 - BevelRadius * 2,
			bevelSize: BevelRadius,
			bevelOffset: -BevelRadius,
			bevelThickness: BevelRadius,
			bevelSegments: 1
		});
		return RGeom.translate(-i/2,-j/2,BevelRadius-k/6);
	}*/
}
var SimpleBrickGeom = [];
var GetSimpleBrickGeom = function(size) {
	if(typeof SimpleBrickGeom[size.x] === "undefined") {
		SimpleBrickGeom[size.x] = [];
	}
	if(typeof SimpleBrickGeom[size.x][size.y] === "undefined") {
		SimpleBrickGeom[size.x][size.y] = [];
	}
	if(typeof SimpleBrickGeom[size.x][size.y][size.z] === "undefined") {
		SimpleBrickGeom[size.x][size.y][size.z] = GenerateSimpleBrick(size.x, size.y, size.z);
	}
	return SimpleBrickGeom[size.x][size.y][size.z];
}



/*///////////////////////////////
//Main page control panel setup//
///////////////////////////////*/
var gtyp = $("#generator-type");
var cgen = $("#controls-gendynamic");

$("#btn-bake").click(function() {
	GenGeoRebuild();
});
$("#btn-clear").click(function() {
	GenDisable();
	/*for(var i = BrickList.length - 1; i >= 0; i--) {
		BrickList.pop();
	}*/
	ClearBrickList();
	if($("#opt-livepreview").get(0).checked)
		NukeGeometry();
	SimpleBrickGeom = [];
	GenEnable();
});
$("#btn-shift").click(function() {
	GenDisable();
	var addX = $("#shiftx").val() * 1;
	var addY = $("#shifty").val() * 1;
	var addZ = $("#shiftz").val() * 1;
	for(var i = 0; i < BrickList.length; i++) {
		BrickList[i].Position.x += addX;
		BrickList[i].Position.y += addY;
		BrickList[i].Position.z += addZ;
	}
	GenEnable();
	if($("#opt-autobake").get(0).checked)
		GenGeoRebuild();
});

gtyp.data("prev",gtyp.val());
gtyp.change(function() {
	var jthis = $(this);
	var nprev = jthis.data("prev");
	var ncurr = jthis.val();
	
	currGen = false;
	
	if(Generators[nprev]) {
		cgen.slideUp(100);
		Generators[nprev].removeControls(cgen);
	} if(Generators[ncurr]) {
		Generators[ncurr].applyControls(cgen);
		cgen.slideDown(100);
		currGen = Generators[ncurr];
	}
	
	jthis.data("prev",ncurr);
});

$("#btn-generate").click(function() {
	if(!currGen) {
		return;
	}
	GenDisable();
	$.when(currGen.generate({BrickCountCap:MASTER_BRICK_LIMIT-BrickList.length, StatusContainer:$("#status-container")})).done(function(buf) {
		if(typeof buf === "undefined" || buf.length == 0) {
			GenEnable();
			return;
		}
		while(buf.length > 0) {
			BrickList.push(buf.pop());
		}
		GenEnable();
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild();
	});
});

cgen.slideUp().finish(); //TODO: this can probably be done in base CSS/HTML