//generators-master.js
//Implementation-specific wrapper around instances of BrickGenerator/StagedBrickGenerator.
//Stores bricks from BrickGenerator in a master list and passes a combined mesh to a ThreeJS previewer (previewer.js).
//TODO ongoing: May have some hardcoded hooks in generators; remove those whenever possible
//TODO: model2brick? minimization will probably be even more of a nightmare than with images

var Generators = {};
var GeneratorNames = [];
var currGen = false;
var GenRunning;

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
	$("#btn-generate").prop("disabled", true).finish().animate({width: 'hide'},{duration:100});
	$("#btn-cancel").prop("disabled", false).finish().delay(10).animate({width: 'show'},{duration:100});
}
var GenEnable = function() {
	$(".gen-lock").prop("disabled", false);
	$("#btn-generate").prop("disabled", false).finish().delay(10).animate({width: 'show'},{duration:100});
	$("#btn-cancel").prop("disabled", true).finish().animate({width: 'hide'},{duration:100});
}



/*///////////////////////////////
//Main page control panel setup//
///////////////////////////////*/
var gtyp = $("#generator-type");
var cgen = $("#controls-gendynamic");

$("#btn-bake").click(function() {
	GenGeoRebuild(); //generators/internal/MeshBaker
});
$("#btn-clear").click(function() {
	GenDisable();
	ClearBrickList();
	if($("#opt-livepreview").get(0).checked)
		NukeGeometry(); //generators/internal/MeshBaker
	BrickGeom = [];
	GenEnable();
});
$("#btn-shift").click(function() {
	GenDisable();
	
	var rprm = Generators["BrickShifter"].generate({StatusContainer:$("#status-container")}, {"BrickList":BrickList, X:$("#shiftx").val()*1, Y:$("#shifty").val()*1, Z:$("#shiftz").val()*1}); //generators/internal/BrickShifter
	GenRunning = rprm;
	$.when(rprm).done(function() {
		GenRunning = undefined;
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild(); //generators/internal/MeshBaker
		else
			GenEnable();
	});
});
$("#btn-mirr").click(function() {
	GenDisable;
	
	var rprm = Generators["BuildMirrorer"].generate({StatusContainer:$("#status-container")}, {
		"BrickList":BrickList,
		X:$("#bt-axisX").get(0).checked,
		Y:$("#bt-axisY").get(0).checked,
		Z:$("#bt-axisZ").get(0).checked
	}); //generators/internal/BrickShifter
	GenRunning = rprm;
	$.when(rprm).done(function() {
		GenRunning = undefined;
			GenEnable();
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild(); //generators/internal/MeshBaker
	});
});
$("#btn-rotCW").click(function() {
	GenDisable;
	
	var rprm = Generators["BuildRotator"].generate({StatusContainer:$("#status-container")}, {
		"BrickList":BrickList,
		X:$("#bt-axisX").get(0).checked?-1:0,
		Y:$("#bt-axisY").get(0).checked?-1:0,
		Z:$("#bt-axisZ").get(0).checked?-1:0
	}); //generators/internal/BrickShifter
	GenRunning = rprm;
	$.when(rprm).done(function() {
		GenRunning = undefined;
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild(); //generators/internal/MeshBaker
		else
			GenEnable();
	});
});
$("#btn-rotCCW").click(function() {
	GenDisable;
	
	var rprm = Generators["BuildRotator"].generate({StatusContainer:$("#status-container")}, {
		"BrickList":BrickList,
		X:$("#bt-axisX").get(0).checked?1:0,
		Y:$("#bt-axisY").get(0).checked?1:0,
		Z:$("#bt-axisZ").get(0).checked?1:0
	}); //generators/internal/BrickShifter
	GenRunning = rprm;
	$.when(rprm).done(function() {
		GenRunning = undefined;
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild(); //generators/internal/MeshBaker
		else
			GenEnable();
	});
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
		jdesc.html('');
	} if(Generators[ncurr]) {
		Generators[ncurr].applyControls(cgen);
		cgen.slideDown(100);
		currGen = Generators[ncurr];
		jdesc.slideDown(100);
		jdesc.html(currGen.description);
	}
	
	jthis.data("prev",ncurr);
});

$("#btn-cancel").click(function() {
	if(typeof GenRunning !== "undefined") {
		GenRunning._genInst._extCancel = true;
	}
});

$("#btn-generate").click(function() {
	if(!currGen) {
		return;
	}
	GenDisable();
	var rprm = currGen.generate({BrickCountCap:MASTER_BRICK_LIMIT-BrickList.length, StatusContainer:$("#status-container")}, {"BrickList":BrickList});
	GenRunning = rprm;
	$.when(rprm).done(function(buf) {
		if(typeof buf === "undefined" || buf.length == 0) {
			GenRunning = undefined;
			GenEnable();
			return;
		}
		while(buf.length > 0) {
			BrickList.push(buf.pop());
		}
		GenRunning = undefined;
		GenEnable();
		if($("#opt-autobake").get(0).checked)
			GenGeoRebuild(); //generators/internal/MeshBaker
	});
});

cgen.slideUp().finish(); //TODO: this can probably be done in base CSS/HTML