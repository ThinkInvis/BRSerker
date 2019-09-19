
var BevelRadius = 0.02;
var RampLipSize = 0.2;
var GenerateSimpleBrick = function(i, j, k, shape) {
	switch(shape) {
		/*case "Cone":
			//supports non-square sizes even though it really doesn't need to
			return new THREE.CylinderGeometry(i/4-BevelRadius,i/2-BevelRadius,k/3-BevelRadius,8).rotateX(3.1415/2).scale(1,(j/2-BevelRadius)/(i/2-BevelRadius),1).translate(BevelRadius/2,BevelRadius/2,BevelRadius/2);
			break;
		case "Round":
			//supports non-square sizes even though it really doesn't need to
			return new THREE.CylinderGeometry(i/2-BevelRadius,i/2-BevelRadius,k/3-BevelRadius,8).rotateX(3.1415/2).scale(1,(j/2-BevelRadius)/(i/2-BevelRadius),1).translate(BevelRadius/2,BevelRadius/2,BevelRadius/2);
			break;*/
		case "Ramp":
			var geom = new THREE.BufferGeometry();
			geom.addAttribute('position', new THREE.BufferAttribute(new Float32Array([
				-0.5, 0.5, -0.5,
				0.5, 0.5, -0.5,
				0.5, -0.5, -0.5,
				-0.5, -0.5, -0.5,
				
				-0.5, 0.5, 0.5,
				0.5, 0.5, 0.5,
				0.5, 0.5, 0.5, //ramp offset by VertOffset: y -= 1
				-0.5, 0.5, 0.5, //ramp offset: y -= 1
				
				-0.5, -0.5, -0.5, //ramp offset: z += lipsize
				0.5, -0.5, -0.5 //ramp offset: z += lipsize
			]), 3));
			geom.index = new THREE.BufferAttribute(new Uint8Array([
				//bottom face: 0123
				0,1,2,
				0,2,3,
				//back face: 0145
				0,5,1,
				0,4,5,
				//top face: 4567
				4,6,5,
				4,7,6,
				//front face: 2389
				2,8,3,
				2,9,8,
				//hypotenuse face: 6789
				6,7,8,
				6,8,9,
				//left face: 03874
				0,3,8,
				0,8,4,
				4,8,7,
				//right face: 12965
				1,9,2,
				1,5,9,
				5,6,9
			]),1);

			geom.addAttribute('vertOffset', new THREE.BufferAttribute(new Float32Array([
				BevelRadius, -BevelRadius, BevelRadius,
				-BevelRadius, -BevelRadius, BevelRadius,
				-BevelRadius, BevelRadius, BevelRadius,
				BevelRadius, BevelRadius, BevelRadius,
				
				BevelRadius, -BevelRadius, -BevelRadius,
				-BevelRadius, -BevelRadius, -BevelRadius,
				-BevelRadius, -1, -BevelRadius, //ramp offset by VertOffset: y += 1
				BevelRadius, -1, -BevelRadius, //ramp offset: y += 1
				
				-BevelRadius, BevelRadius, RampLipSize, //ramp offset: z += lipsize
				-BevelRadius, -BevelRadius, RampLipSize //ramp offset: z += lipsize
			]), 3));
			return geom;
			break;
		case "RampCorner":
			var geom = new THREE.BufferGeometry();
			geom.addAttribute('position', new THREE.BufferAttribute(new Float32Array([
			
				/*new THREE.Vector3(xm,ym,zm), //0: back bottom left
				new THREE.Vector3(xp,ym,zm), //1: back bottom right
				new THREE.Vector3(xp,yp,zm), //2: front bottom right
				new THREE.Vector3(xm,yp,zm), //3: front bottom left
				
				new THREE.Vector3(xm,ym,zp), //4: back top left
				new THREE.Vector3(xc1,ym,zp), //5: back top semiright
				new THREE.Vector3(xc1,yc1,zp), //6: semifront top semiright
				new THREE.Vector3(xm,yc1,zp), //7: semifront top left
				
				new THREE.Vector3(xp,ym,zc2), //8: back semitop right
				new THREE.Vector3(xp,yp,zc2), //9: front semitop right
				new THREE.Vector3(xm,yp,zc2) //A: front semitop left*/
				
				0.5, 0.5, -0.5,
				-0.5, 0.5, -0.5,
				-0.5, -0.5, -0.5,
				0.5, -0.5, -0.5,
				
				0.5, 0.5, 0.5,
				0.5, 0.5, 0.5, //ramp offset: x -= 1
				0.5, 0.5, 0.5, //ramp offset: x -= 1, y -= 1
				0.5, 0.5, 0.5, //ramp offset: y -= 1
				
				-0.5, 0.5, -0.5, //ramp offset: z += lipsize
				-0.5, -0.5, -0.5, //ramp offset: z += lipsize
				0.5, -0.5, -0.5 //ramp offset: z += lipsize
			]), 3));
			geom.index = new THREE.BufferAttribute(new Uint8Array([
				//bottom face: 0123
				0,2,1,
				0,3,2,
				//top face: 4567
				4,5,6,
				4,6,7,
				//topfront face: 7A96
				7,9,10,
				7,6,9,
				//topright face: 5689
				5,9,6,
				5,8,9,
				//front face: 23A9
				2,3,10,
				9,2,10,
				//right face: 1298
				1,2,8,
				9,8,2,
				//back face: 01854
				0,1,8,
				0,8,5,
				0,5,4,
				//left face: 03A74
				0,10,3,
				0,7,10,
				0,4,7
			]),1);

			geom.addAttribute('vertOffset', new THREE.BufferAttribute(new Float32Array([
				-BevelRadius, -BevelRadius, BevelRadius,
				BevelRadius, -BevelRadius, BevelRadius,
				BevelRadius, BevelRadius, BevelRadius,
				-BevelRadius, BevelRadius, BevelRadius,
				
				-BevelRadius, -BevelRadius, -BevelRadius,
				-1, -BevelRadius, -BevelRadius,
				-1, -1, -BevelRadius, //ramp offset by VertOffset: y += 1
				-BevelRadius, -1, -BevelRadius, //ramp offset: y += 1
				
				BevelRadius, -BevelRadius, RampLipSize, //ramp offset: z += lipsize
				BevelRadius, BevelRadius, RampLipSize, //ramp offset: z += lipsize
				-BevelRadius, BevelRadius, RampLipSize //ramp offset: z += lipsize
			]), 3));
			return geom;
			break;
		case "Basic":
		default:
			var geom = new THREE.BufferGeometry();
			geom.addAttribute('position', new THREE.BufferAttribute(new Float32Array([
				-0.5, -0.5, -0.5, //0: lower back left
				0.5, -0.5, -0.5,  //1: lower back right
				0.5, 0.5, -0.5,   //2: lower front right
				-0.5, 0.5, -0.5,  //3: lower front left
				-0.5, -0.5, 0.5,  //4: upper back left
				0.5, -0.5, 0.5,   //5: upper back right
				0.5, 0.5, 0.5,    //6: upper front right
				-0.5, 0.5, 0.5    //7: upper front left
			]), 3));
			geom.index = new THREE.BufferAttribute(new Uint8Array([
				//bottom face 0123 (lower back left > lower front right)
				0,2,1,
				0,3,2,
				//top face 4567 (upper back left > upper front right)
				4,5,6,
				4,6,7,
				//left face 0347 (lower back left > upper front left)
				0,7,3,
				0,4,7,
				//right face 1256 (lower back right > upper front right)
				1,2,6,
				1,6,5,
				//front face 2367 (lower front left > upper front right)
				3,6,2,
				3,7,6,
				//back face 0145 (lower back left > upper back right)
				0,1,5,
				0,5,4
			]),1);
			geom.addAttribute('vertOffset', new THREE.BufferAttribute(new Float32Array([
				BevelRadius, BevelRadius, BevelRadius,
				-BevelRadius, BevelRadius, BevelRadius,
				-BevelRadius, -BevelRadius, BevelRadius,
				BevelRadius, -BevelRadius, BevelRadius,
				BevelRadius, BevelRadius, -BevelRadius,
				-BevelRadius, BevelRadius, -BevelRadius,
				-BevelRadius, -BevelRadius, -BevelRadius,
				BevelRadius, -BevelRadius, -BevelRadius,
			]), 3));
			return geom;
	}
}
/*//////////////////////////////
//Mesh baking for previewer.js//
//////////////////////////////*/

//referenced in previewer.js; main render object for all bricks
function SetupMasterInst(type) {
	var ngm = new THREE.InstancedBufferGeometry()
	ngm.copy(GenerateSimpleBrick(1,1,1,type));
	

	var mtxArr = [
		new Float32Array(MASTER_BRICK_LIMIT*4),
		new Float32Array(MASTER_BRICK_LIMIT*4),
		new Float32Array(MASTER_BRICK_LIMIT*4),
		new Float32Array(MASTER_BRICK_LIMIT*4)
	];
	
	for(var j = 0; j < 4; j++) {
		ngm.addAttribute(
			`aInstanceMatrix${j}`,
			new THREE.InstancedBufferAttribute(mtxArr[j],4)
		);
	}
	
	ngm.addAttribute(
		'aInstanceScale',
		new THREE.InstancedBufferAttribute(new Float32Array(MASTER_BRICK_LIMIT*3), 3)
	);
	
	ngm.addAttribute(
		'aInstanceColor',
		new THREE.InstancedBufferAttribute(new Float32Array(MASTER_BRICK_LIMIT*3), 3)
	);
	
	ngm.maxInstancedCount = 0; //will be dynamically set as bricks are added	
	
	var GenMesh = new THREE.Mesh(ngm, GenMaterial);
	GenMesh.frustumCulled = false;
	PvwScene.add(GenMesh);
	ngm.MeshRef = GenMesh;

	return ngm;
}

var sVtx = `precision highp float;

attribute vec3 vertOffset;

attribute vec4 aInstanceMatrix0;
attribute vec4 aInstanceMatrix1;
attribute vec4 aInstanceMatrix2;
attribute vec4 aInstanceMatrix3;
attribute vec3 aInstanceScale;
attribute vec3 aInstanceColor;

varying vec3 vInstColor;
varying vec3 vViewPosition;

void main() {
	mat4 aInstanceMatrix = mat4(
		aInstanceMatrix0,
		aInstanceMatrix1,
		aInstanceMatrix2,
		aInstanceMatrix3
	);
	

	vInstColor = aInstanceColor;
	vec3 ofs = position * aInstanceScale + vertOffset;
	vec4 tsf = aInstanceMatrix * vec4(ofs, 1.);
	
	vec4 mvPosition = modelViewMatrix * tsf;
	vViewPosition = -mvPosition.xyz;
	
	gl_Position = projectionMatrix * mvPosition;
}
`;
var sFrag = `precision highp float;

varying vec3 vInstColor;
varying vec3 vViewPosition;

struct DirectionalLight {
	vec3 direction;
	vec3 color;
	int shadow;
	float shadowBias;
	float shadowRadius;
	vec2 shadowMapSize;
};
uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];

void main() {
	
	//InstancedBufferGeometry with a vertex offset attribute is incredibly hard to set normals up for... so use Magical Bullshit Calculus (tm) to calculate flatshading normals ex nihilo
	vec3 fdx = dFdx(vViewPosition);
	vec3 fdy = dFdy(vViewPosition);
	vec3 vCamNormal = normalize(cross(fdx,fdy));
	
	vec4 lightColor = vec4(0.,0.,0.,1.);
	for(int l = 0; l < NUM_DIR_LIGHTS; l++) {
		lightColor.rgb += clamp(dot(directionalLights[l].direction, vCamNormal), 0.0, 1.0) * directionalLights[l].color;
	}
	
	lightColor = clamp(lightColor, 0.4, 1.0);
	
	gl_FragColor = vec4(vInstColor, 1.) * lightColor;
	//gl_FragColor = vec4((vCamNormal+1.0)/2.0, 1.);
	//gl_FragColor = vec4(vInstColor, 1.);
}
`;


//var GenMaterial = new THREE.MeshToonMaterial({vertexColors: THREE.FaceColors});
var GenMaterial = new THREE.ShaderMaterial({vertexColors: THREE.VertexColors, vertexShader: sVtx, fragmentShader: sFrag, lights: true, flatShading: true, extensions: {derivatives: true}, uniforms: THREE.UniformsUtils.merge(
	[
		THREE.UniformsLib['lights']
	]
)});

var EmptyGeometry = new THREE.PlaneGeometry();

var NukeGeometry = function() {
	for(var g = 0; g < GenInstGeomIndexed.length; g++) {
		for(var i = 0; i < GenInstGeomIndexed[g].maxInstancedCount; i++) {
			GenInstGeomIndexed[g].attributes.aInstanceMatrix0.setXYZW(i, 0, 0, 0, 0);
			GenInstGeomIndexed[g].attributes.aInstanceMatrix1.setXYZW(i, 0, 0, 0, 0);
			GenInstGeomIndexed[g].attributes.aInstanceMatrix2.setXYZW(i, 0, 0, 0, 0);
			GenInstGeomIndexed[g].attributes.aInstanceMatrix3.setXYZW(i, 0, 0, 0, 0);
			GenInstGeomIndexed[g].attributes.aInstanceColor.setXYZ(i, 0, 0, 0);
			GenInstGeomIndexed[g].attributes.aInstanceScale.setXYZ(i, 0, 0, 0);
		}
		GenInstGeomIndexed[g].maxInstancedCount = 0;
	}
	ForceUpdateGeometry();
}
var ForceUpdateGeometry = function() {
	for(var g = 0; g < GenInstGeomIndexed.length; g++) {
		GenInstGeomIndexed[g].getAttribute('aInstanceMatrix0').needsUpdate = true;
		GenInstGeomIndexed[g].getAttribute('aInstanceMatrix1').needsUpdate = true;
		GenInstGeomIndexed[g].getAttribute('aInstanceMatrix2').needsUpdate = true;
		GenInstGeomIndexed[g].getAttribute('aInstanceMatrix3').needsUpdate = true;
		GenInstGeomIndexed[g].getAttribute('aInstanceColor').needsUpdate = true;
		GenInstGeomIndexed[g].getAttribute('aInstanceScale').needsUpdate = true;
	}
}

var GenInstGeom = {
	Basic: SetupMasterInst("Basic"),
	Cone: SetupMasterInst("Cone"),
	Round: SetupMasterInst("Round"),
	Ramp: SetupMasterInst("Ramp"),
	RampCorner: SetupMasterInst("RampCorner")
}
var GenInstGeomIndexed = [
	GenInstGeom.Basic,
	GenInstGeom.Cone,
	GenInstGeom.Round,
	GenInstGeom.Ramp,
	GenInstGeom.RampCorner
];

//squishing all these bricks together is slow, so use a slowiterator to avoid locking the UI thread
var SBG_SI_MeshBaker = new SBG_SlowIterator(function(inst) {
	var currBrick = inst.bricks[inst.currI];
	var currBuf = GenInstGeom[currBrick.IntRef];
	var currBufPos = currBuf.maxInstancedCount;
	
	var tmtx = new THREE.Matrix4();
	tmtx.multiply(new THREE.Matrix4().makeTranslation(currBrick.Position.x, currBrick.Position.y, currBrick.Position.z/3));
	switch(currBrick.FacingIndex) {
		case 0: //+z to +x
			tmtx.multiply(new THREE.Matrix4().makeRotationY(3.14159265/2));
			break;
		case 2: //+z to +y
			tmtx.multiply(new THREE.Matrix4().makeRotationX(3.14159265/2));
			break;
		case 5: //+z to -z
			tmtx.multiply(new THREE.Matrix4().makeRotationY(3.14159265));
			tmtx.multiply(new THREE.Matrix4().makeRotationZ(3.14159265));
			break;
		case 1: //+z to -x
			tmtx.multiply(new THREE.Matrix4().makeRotationY(-3.14159265/2));
			break;
		case 3: //+x to -y
			tmtx.multiply(new THREE.Matrix4().makeRotationX(-3.14159265/2));
			break;
		case 4: //+z
		default:
			break;
	}
	tmtx.multiply(new THREE.Matrix4().makeRotationZ(currBrick.RotationIndex*3.14159265/2));
	
	var ii = 0;
	var atr0 = currBuf.getAttribute('aInstanceMatrix0');
	var atr1 = currBuf.getAttribute('aInstanceMatrix1');
	var atr2 = currBuf.getAttribute('aInstanceMatrix2');
	var atr3 = currBuf.getAttribute('aInstanceMatrix3');
	atr0.setX(currBufPos, tmtx.elements[0]);
	atr0.setY(currBufPos, tmtx.elements[1]);
	atr0.setZ(currBufPos, tmtx.elements[2]);
	atr0.setW(currBufPos, tmtx.elements[3]);
	atr1.setX(currBufPos, tmtx.elements[4]);
	atr1.setY(currBufPos, tmtx.elements[5]);
	atr1.setZ(currBufPos, tmtx.elements[6]);
	atr1.setW(currBufPos, tmtx.elements[7]);
	atr2.setX(currBufPos, tmtx.elements[8]);
	atr2.setY(currBufPos, tmtx.elements[9]);
	atr2.setZ(currBufPos, tmtx.elements[10]);
	atr2.setW(currBufPos, tmtx.elements[11]);
	atr3.setX(currBufPos, tmtx.elements[12]);
	atr3.setY(currBufPos, tmtx.elements[13]);
	atr3.setZ(currBufPos, tmtx.elements[14]);
	atr3.setW(currBufPos, tmtx.elements[15]);
	
	var atrc = currBuf.getAttribute('aInstanceColor');
	
	atrc.setX(currBufPos, currBrick.Color.r);
	atrc.setY(currBufPos, currBrick.Color.g);
	atrc.setZ(currBufPos, currBrick.Color.b);
	
	var atrs = currBuf.getAttribute('aInstanceScale');
	
	atrs.setX(currBufPos, currBrick.BoundingBox.x);
	atrs.setY(currBufPos, currBrick.BoundingBox.y);
	atrs.setZ(currBufPos, currBrick.BoundingBox.z/3);
	
	currBuf.maxInstancedCount++;
	
	
	//calculation for bbox display
	var lx = currBrick.Position.x - currBrick.BoundingBox.x/2;
	var ux = currBrick.Position.x + currBrick.BoundingBox.x/2;
	var ly = currBrick.Position.y - currBrick.BoundingBox.y/2;
	var uy = currBrick.Position.y + currBrick.BoundingBox.y/2;
	var lz = currBrick.Position.z - currBrick.BoundingBox.z/2;
	var uz = currBrick.Position.z + currBrick.BoundingBox.z/2;
	if(lx < inst.bbox[0]) inst.bbox[0] = lx;
	if(ly < inst.bbox[1]) inst.bbox[1] = ly;
	if(lz < inst.bbox[2]) inst.bbox[2] = lz;
	if(ux > inst.bbox[3]) inst.bbox[3] = ux;
	if(uy > inst.bbox[4]) inst.bbox[4] = uy;
	if(uz > inst.bbox[5]) inst.bbox[5] = uz;

	inst.currI ++;
	return inst.currI == inst.maxI || inst.currI == MASTER_BRICK_LIMIT; //TODO: something about SBG is allowing one more brick than the limit to be generated
},{
	RunSpeed: 50,
	MaxExecTime: 40,
	TEST_GateByTime: true,
	OnStageSetup: function(inst) {
		inst.currI = 0;
		inst.maxI = inst.bricks.length;
		inst.bbox = [0, 0, 0, 0, 0, 0];
		if(inst.maxI == 0) inst.abort = "No bricks to bake";
		BrickGeom = [];
	},
	OnStagePause: function(inst) {
		return "Baking mesh... " + Math.floor(inst.currI/inst.maxI*100) + "%";
	},
	OnStageFinalize: function(inst) {
		inst.bsize = [
			inst.bbox[3]-inst.bbox[0],
			inst.bbox[4]-inst.bbox[1],
			(inst.bbox[5]-inst.bbox[2])/3,
		];
		inst.bcenter = [
			inst.bbox[0]+inst.bsize[0]/2,
			inst.bbox[1]+inst.bsize[1]/2,
			inst.bbox[2]/3+inst.bsize[2]/2
		];
		var nzwhole = Math.floor(inst.bsize[2]);
		var nzflat = Math.floor((inst.bsize[2] - nzwhole)*3);
		if(nzflat == 0) {
			$("#label-bounds").text("Size: " + inst.bsize[0].toFixed(0) + "x" + inst.bsize[1].toFixed(0) + "x" + nzwhole.toFixed(0));
		} else {
			$("#label-bounds").text("Size: " + inst.bsize[0].toFixed(0) + "x" + inst.bsize[1].toFixed(0) + "x(" + nzwhole.toFixed(0) + "+" + nzflat.toFixed(0) + "f)");
		}
		$("#label-cog").text("CoG: " + inst.bcenter[0].toFixed(1) + ", " + inst.bcenter[1].toFixed(1) + ", " + inst.bcenter[2].toFixed(1));
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
		
		if(!$("#opt-livepreview").is(':checked'))
			PvwRenderer.render(PvwScene, PvwCamera);
		
		GenEnable();
	});
}