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
			inst._ticket.Text = "Waiting for file read: OBJ" + (inst.noMtl ? "" : ", MTL") + "...";
		
		var p1 = $.Deferred();
		var p2 = $.Deferred();
		
		var reader = new FileReader();
		reader.onload = function(e) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Waiting for file read: MTL...";
			p1.resolve(this.result);
		}
		reader.readAsText(inst.fileName, "ISO-8859-1");
		
		if(inst.noMtl)
			p2.resolve();
		else {
			var mtlreader = new FileReader();
			mtlreader.onload = function(e) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Waiting for file read: OBJ...";
				p2.resolve(this.result);
			}
			mtlreader.readAsText(inst.mtlFileName, "ISO-8859-1");
		}
		
		$.when(p1, p2).done(function(objtxt,mtltxt) {
			if(inst._statusEnabled)
				inst._ticket.Text = "Parsing files...";
			var objldr = new THREE.OBJLoader();
			if(!inst.noMtl) {
				var mtlldr = new THREE.MTLLoader();
				var mtldata;
				try {
					mtldata = mtlldr.parse(mtltxt);
				} catch(ex) {
					inst.abort = "Error in MTLLoader: " + ex;
					inst.abortFatal = true;
					promise.resolve(inst);
					return;
				}
				objldr.setMaterials(mtldata);
			}
			var objdata;
			try {
				objdata = objldr.parse(objtxt);
			} catch(ex) {
				inst.abort = "Error in OBJLoader: " + ex;
				inst.abortFatal = true;
				promise.resolve(inst);
				return;
			}
			
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
		var mtl = 0;
		if(!inst.noMtl && typeof inst.geoms[inst.currI].material !== "undefined") {
			var fcMtl = inst.geoms[inst.currI].material[fc.materialIndex];
			if(typeof fcMtl !== "undefined" && typeof fcMtl.color !== "undefined") {
				if(typeof inst.mtlOverrides[fc.materialIndex] !== "undefined" && inst.mtlOverrides[fc.materialIndex] !== "0" && inst.mtlOverrides[fc.materialIndex] !== "")
					mtl = inst.mtlOverrides[fc.materialIndex]
				color = [fcMtl.color.r, fcMtl.color.g, fcMtl.color.b, 1.0, inst.baseColor[4], inst.baseColor[5], mtl];
			}
			else {
				fcMtl = inst.geoms[inst.currI].material;
				if(typeof fcMtl !== "undefined" && typeof fcMtl.color !== "undefined")
					color = [fcMtl.color.r, fcMtl.color.g, fcMtl.color.b, 1.0, inst.baseColor[4], inst.baseColor[5], mtl];
				
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
		var ptMax = ptA.clone().max(ptB).max(ptC).min(new THREE.Vector3(inst.maxX-1,inst.maxY-1,inst.maxZ/3-1)).ceil();
		
		//todo: better algorithm
		//maybe here
		//https://github.com/gerddie/mia/blob/master/mia/3d/imagedraw.cc
		//end goal is to sum up the area contained in each voxel of tris of each material
		var colVals = [];
		var colCounts = [];
		for(var i = ptMin.x; i <= ptMax.x; i += inst.invSS) {
			for(var j = ptMin.y; j <= ptMax.y; j += inst.invSS) {
				for(var k = ptMin.z*3; k <= ptMax.z*3; k += inst.invSS) {
					var ibox = new THREE.Box3(
						new THREE.Vector3(i,j,k/3),
						new THREE.Vector3(i+inst.invSS,j+inst.invSS,(k+inst.invSS)/3)
					);
					if(ibox.intersectsTriangle(ptTri))
						inst.ssvox[Math.floor(i)][Math.floor(j)][Math.floor(k)].push(color);
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
		Batching: 10,
		OnStageSetup: function(inst) {
			inst.maxI = inst.geoms.length;
			inst.maxT = inst.geoms[0].faces.length;
			//TODO: do we need any special handling for groups? for now, only basic blender export is known to work
			inst.currI = 0;
			inst.currT = 0;
			
			inst.maxX = Math.ceil(inst.bsize.x*inst.res/inst.bmax);
			inst.maxY = Math.ceil(inst.bsize.y*inst.res/inst.bmax);
			inst.maxZ = Math.ceil(inst.bsize.z*inst.res/inst.bmax*3);
			
			inst.ssvox = [];
			for(var i = 0; i < inst.maxX; i++) {
				inst.ssvox[i] = [];
				for(var j = 0; j < inst.maxY; j++) {
					inst.ssvox[i][j] = [];
					for(var k = 0; k < inst.maxZ; k++) {
						inst.ssvox[i][j][k] = [];
					}
				}
			}
			
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
	new SBG_SlowIterator(function(inst) {
		var currVox = inst.ssvox[inst.currX][inst.currY][inst.currZ];
		
		if(currVox.length == 0) {
			inst.vox[inst.currX][inst.currY][inst.currZ] = "skip";
		} else {
			var cVals = [];
			var cCounts = [];
			var highestVal = "skip";
			var highestCount = 0;
			for(var i = 0; i < currVox.length; i++) {
				var a = currVox[i];
				for(var n = 0; n < cVals.length; n++) {
					var b = cVals[n];
					if(a[0] == b[0] && a[1] == b[1] && a[2] == b[2] && a[3] == b[3] && a[4] == b[4] && a[5] == b[5] && a[6] == b[6]) {
						cCounts[n] ++;
						if(cCounts[n] >= inst.SSMin && cCounts[n] > highestCount) {
							highestCount = cCounts[n];
							highestVal = cVals[n];
						}
						break;
					}
				}
				cCounts.push(1);
				cVals.push(a);
			}
			
			inst.vox[inst.currX][inst.currY][inst.currZ] = highestVal;
		}
		
		inst.currX++;
		if(inst.currX >= inst.maxX) {
			inst.currX = 0;
			inst.currY ++;
		}
		if(inst.currY >= inst.maxY) {
			inst.currY = 0;
			inst.currZ ++;
		}
		return inst.currZ >= inst.maxZ;
	}, {
		Batching: 1000,
		OnStageSetup: function(inst) {
			inst.currX = 0;
			inst.currY = 0;
			inst.currZ = 0;
		},
		OnStagePause: function(inst) {
			return "Resolving subsampling... " + inst.currZ + "/" + inst.maxZ;
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
		SSResLabel: $("<span class='opt-1-2'>Subsampling Res.:</span>"),
		SSRes: $("<input>", {"type": "number", "min": 1, "max": 16, "value": 4, "step": 1, "class": "opt-1-2 opt-input"}),
		SSMinLabel: $("<span class='opt-1-2'>Subsampling Min.:</span>"),
		SSMin: $("<input>", {"type": "number", "min": 1, "max": 256, "value": 1, "step": 1, "class": "opt-1-2 opt-input"}),
		MtlOvrLabel: $("<span class='opt-1-2'>Material Overrides:</span>"),
		MtlOvr: $("<textarea>", {"title": "Set a word to 0/empty for default material, or e.g. BMC_Metallic to change that material index's color. May not work properly on multiple-mesh objects, grouped OBJ files, etc.", "class": "opt-1-2 opt-input"}),
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
		
		inst.mtlOverrides = this.controls.MtlOvr.val().split(" ");
		inst.baseColor = [this.controls.ColorR.val()*1, this.controls.ColorG.val()*1, this.controls.ColorB.val()*1, 1.0, 0, "Basic", 0];
		inst.res = this.controls.Res.val()*1;
		inst.fileName = this.controls.Reader.get(0).files[0];
		inst.mtlFileName = this.controls.MtlReader.get(0).files[0];
		
		inst.SSRes = this.controls.SSRes.val()*1;
		inst.SSMin = this.controls.SSMin.val()*1;
		inst.invSS = 1/inst.SSRes;
		
		inst.octreeIrregular = true;
		inst.octreeScale = [1,1,1];
		inst.octreeSizeLimit = [204, 204, 511];
	},
	Description: "Generates a shell of bricks around the geometry defined in an OBJ file."
});

RegisterGenerator(NewGen, GenDisplayName, GenName, GenCategory);