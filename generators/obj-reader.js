var GenName = "ObjReader";
var GenDisplayName = "3D Model (OBJ)";
var GenCategory = "File Readers";

var RecursiveUnpackObj = function(obj, arr = [], vis = []) {
	//not sure if circular references can even happen here but better safe than sorry
	if(!vis.includes(obj)) {
		vis.push(obj);
		if(typeof obj.geometry !== "undefined") arr.push(new THREE.Geometry().fromBufferGeometry(obj.geometry));
		if(typeof obj.material !== "undefined") arr[arr.length-1].material = obj.material;
		if(obj.children.length > 0) {
			for(var i = 0; i < obj.children.length; i++) {
				RecursiveUnpackObj(obj.children[i], arr, vis);
			}
		}
	}
	
	return arr;
}

var NewGen = new StagedBrickGenerator(GenName, [
	{apply: function(inst, promise) {
		if(inst._statusEnabled)
			inst._ticket.Text = "Waiting for file read...";
		
		var p1 = $.Deferred();
		var p2 = $.Deferred();
		
		var reader = new FileReader();
		reader.onload = function(e) {
			p1.resolve(this.result);
		}
		reader.readAsText(inst.fileName, "ISO-8859-1");
		
		if(inst.noMtl)
			p2.resolve();
		else {
			var mtlreader = new FileReader();
			mtlreader.onload = function(e) {
				p2.resolve(this.result);
			}
			mtlreader.readAsText(inst.mtlFileName, "ISO-8859-1");
		}
		
		$.when(p1, p2).done(function(objtxt,mtltxt) {
			var objldr = new THREE.OBJLoader();
			if(!inst.noMtl) {
				var mtlldr = new THREE.MTLLoader();
				var mtldata = mtlldr.parse(mtltxt);
				objldr.setMaterials(mtldata);
			}
			var objdata = objldr.parse(objtxt);
			
			inst.geoms = RecursiveUnpackObj(objdata);
			inst.geoms[0].computeBoundingBox();
			inst.bbox = inst.geoms[0].boundingBox.clone();
			for(var i = 1; i < inst.geoms.length; i++) {
				inst.geoms[i].computeBoundingBox();
				inst.bbox.union(inst.geoms[i].boundingBox);
			}
			inst.bsize = inst.bbox.max.clone().sub(inst.bbox.min);
			inst.bmax = Math.max(inst.bsize.x, inst.bsize.y, inst.bsize.z);
			promise.resolve(inst);
		});
	}},
	new SBG_SlowIterator(function(inst) {
		var fc = inst.geoms[inst.currI].faces[inst.currT];
		
		var color = inst.baseColor;
		if(!inst.noMtl && typeof inst.geoms[inst.currI].material !== "undefined") {
			var fcMtl = inst.geoms[inst.currI].material[fc.materialIndex];
			if(typeof fcMtl !== "undefined" && typeof fcMtl.color !== "undefined")
				color = [fcMtl.color.r, fcMtl.color.g, fcMtl.color.b, 1.0];
			else {
				fcMtl = inst.geoms[inst.currI].material;
				if(typeof fcMtl !== "undefined" && typeof fcMtl.color !== "undefined")
					color = [fcMtl.color.r, fcMtl.color.g, fcMtl.color.b, 1.0];
				
			}
		}
		
		var ptA = inst.geoms[inst.currI].vertices[fc.a].clone()
			.sub(inst.bbox.min).multiplyScalar(inst.res/inst.bmax);
		var ptB = inst.geoms[inst.currI].vertices[fc.b].clone()
			.sub(inst.bbox.min).multiplyScalar(inst.res/inst.bmax);
		var ptC = inst.geoms[inst.currI].vertices[fc.c].clone()
			.sub(inst.bbox.min).multiplyScalar(inst.res/inst.bmax);
		
		var ptTri = new THREE.Triangle(ptA, ptB, ptC);
		
		var ptMin = ptA.clone().min(ptB).min(ptC).max(new THREE.Vector3(0,0,0)).floor();
		var ptMax = ptA.clone().max(ptB).max(ptC).min(new THREE.Vector3(inst.maxX-1,inst.maxY-1,inst.maxZ-1)).ceil();
		
		//todo: better algorithm
		//maybe here
		//https://github.com/gerddie/mia/blob/master/mia/3d/imagedraw.cc
		for(var i = ptMin.x; i <= ptMax.x; i++) {
			for(var j = ptMin.y; j <= ptMax.y; j++) {
				for(var k = ptMin.z; k <= ptMax.z; k++) {
					var ibox = new THREE.Box3(
						new THREE.Vector3(i,j,k),
						new THREE.Vector3(i+1,j+1,k+1)
					);
					if(ibox.intersectsTriangle(ptTri))
						inst.vox[i][j][k] = color;
						//also todo: load material colors, determine which to use based on the most polygon area of that material contained within the voxel?
				}
			}
		}
		
		inst.currT++;
		if(inst.currT >= inst.maxT) {
			inst.currT = 0;
			inst.currI ++;
			if(inst.currI >= inst.maxI) return true;
			inst.maxT = inst.geoms[inst.currI].faces.length;
		}
	}, {
		Batching: 100,
		OnStageSetup: function(inst) {
			inst.maxI = inst.geoms.length;
			inst.maxT = inst.geoms[0].faces.length;
			//TODO: do we need any special handling for groups? for now, only basic blender export is known to work
			inst.currI = 0;
			inst.currT = 0;
			
			inst.maxX = Math.ceil(inst.bsize.x*inst.res/inst.bmax);
			inst.maxY = Math.ceil(inst.bsize.y*inst.res/inst.bmax);
			inst.maxZ = Math.ceil(inst.bsize.z*inst.res/inst.bmax);
			
			console.log(inst);
			
			inst.vox = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.vox[i] = [];
				for(var j = 0; j < inst.maxY; j++) {
					inst.vox[i][j] = [];
					for(var k = 0; k < inst.maxZ; k++) {
						inst.vox[i][j][k] = "skip";
					}
				}
			}
			
		},
		OnStagePause: function(inst) {
			return "Filling tris... " + inst.currT + "/" + inst.maxT + " on " + inst.currI + "/" + inst.maxI;
		}
	}),
	SBGSI_OctreeVoxels
], {
	Controls: {
		ReaderLabel: $("<span class='opt-1-4'>.OBJ:</span>"),
		Reader: $("<input>", {"type":"file", "class":"opt-3-4", "accept":".obj", "height":"20"}),
		MtlReaderLabel: $("<span class='opt-1-4'>.MTL:</span>"),
		MtlReader: $("<input>", {"type":"file", "class":"opt-3-4", "accept":".mtl", "height":"20"}),
		ResLabel: $("<span class='opt-1-2'>Resolution:</span>"),
		Res: $("<input>", {"type": "number", "min": 1, "max": 512, "value": 64, "step": 1, "class": "opt-1-2 opt-input"}),
		ColorLabel: $("<span>", {"class":"opt-1-4","text":"Color:"}),
		ColorR: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":1, "step":0.001}),
		ColorG: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0, "step":0.001}),
		ColorB: $("<input>", {"type":"number", "class":"opt-1-4 opt-input", "min":0, "max":1, "value":0, "step":0.001})
	},
	OnSetup: function(inst) {
		if(this.controls.Reader.get(0).files.length < 1) {
			inst.abort = "No OBJ file loaded";
			return;
		}
		if(this.controls.MtlReader.get(0).files.length < 1) {
			inst.noMtl = true;
		}
		
		inst.baseColor = [this.controls.ColorR.val()*1, this.controls.ColorG.val()*1, this.controls.ColorB.val()*1, 1.0];
		inst.res = this.controls.Res.val()*1;
		inst.fileName = this.controls.Reader.get(0).files[0];
		inst.mtlFileName = this.controls.MtlReader.get(0).files[0];
		
		inst.octreeIrregular = true;
		inst.octreeSizeLimit = [204, 204, 511];
	},
	Description: "Generates a shell of bricks around the geometry defined in an OBJ file."
});

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);