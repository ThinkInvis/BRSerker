//generators-master.js
//Implementation-specific wrapper around instances of BrickGenerator/StagedBrickGenerator.
//Stores bricks from BrickGenerator in a master list and passes a combined mesh to a ThreeJS previewer (previewer.js).
//TODO ongoing: May have some hardcoded hooks in generators; remove those whenever possible
//TODO: model2brick? minimization will probably be even more of a nightmare than with images

var Generators = {};
var GeneratorNames = [];
var currGen = false;

var MASTER_BRICK_LIMIT = 1000000; //may start dropping frames before this, but memory can probably handle this many thanks to InstancedBufferGeometry :)
//initial memory required WITH NO ACTUAL BRICKS LOADED is something like 88kb per potential brick, for ~84MB/bricktype at 1mil bricks. however, this means that threejs's memory footprint for actually adding bricks is *very small* if not nothing... our own brickdata object takes about as much memory, maybe a bit more, than the initial buffer allocation. this is MUCH more efficient than the old "One True Geometry Object" approach (2GB+ memory at 100k bricks)!

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
	$(".gen-lock").prop("disabled", true);
}
var GenEnable = function() {
	$(".gen-lock").prop("disabled", false);
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
	BrickGeom = [];
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
	var jdesc = $('#generator-descr');
	
	currGen = false;
	
	if(Generators[nprev]) {
		cgen.slideUp(100);
		Generators[nprev].removeControls(cgen);
		jdesc.slideUp(100);
		jdesc.text('');
	} if(Generators[ncurr]) {
		Generators[ncurr].applyControls(cgen);
		cgen.slideDown(100);
		currGen = Generators[ncurr];
		jdesc.slideDown(100);
		jdesc.text(currGen.description);
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