var PvwDom = $("#panel-preview");

//Scene/renderer/camera setup
var pWid = PvwDom.width();
var pHei = PvwDom.height();
var PvwScene = new THREE.Scene();
var PvwCamera = new THREE.PerspectiveCamera(90, pWid/pHei, 0.1, 1000);
var PvwRenderer = new THREE.WebGLRenderer();
PvwRenderer.setSize(pWid, pHei);
PvwDom.append(PvwRenderer.domElement);
var PvwControls = new OrbitControls(PvwCamera, PvwRenderer.domElement, {
	//enableDamping: true,
	rotateSpeed: -0.25
});
PvwCamera.up.set(0, 0, 1);
PvwCamera.position.set(2, 2, 4);
PvwControls.update();

//Mouse tracking/raycasting
var PvwCaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0), 0.1, 1000);
var PvwMX = 0;
var PvwMY = 0;
var PvwBBox = PvwDom.get(0).getBoundingClientRect();
PvwDom.on('mousemove', function(e) {
	PvwMX = ((e.clientX - PvwDom.offset().left) / PvwBBox.width) * 2 - 1;
	PvwMY = -((e.clientY - PvwDom.offset().top) / PvwBBox.height) * 2 + 1;
});

var PvwRaycast = function() {
	if(typeof GenMesh === "undefined") {
		return {};
	}
	var MouseVec2 = new THREE.Vector2(PvwMX, PvwMY);
	PvwCaster.setFromCamera(MouseVec2, PvwCamera);
	return PvwCaster.intersectObject(GenMesh);
}

//Resize handler
window.addEventListener('resize', function() {
	PvwBBox = PvwDom.get(0).getBoundingClientRect();
	pWid = $("#panel-preview").width();
	pHei = $("#panel-preview").height();
	PvwCamera.aspect = pWid/pHei;
	PvwCamera.updateProjectionMatrix();
	
	PvwRenderer.setSize(pWid,pHei);
}, false);

//Stats panel
var PvwStats = new Stats();
PvwStats.showPanel(0);
PvwDom.append(PvwStats.domElement);
$(PvwStats.domElement).css({"position": "absolute"});

//Grid object
var bgMajorGridGeometry = new THREE.Geometry();
var bgMinorGridGeometry = new THREE.Geometry();
var gridRadius = 2;
var gridMaj = 2;
var gridRes = 1;
gridRadius /= gridRes;
gridMaj /= gridRes;
for(var i = -gridRadius; i <= gridRadius; i++) {
	for(var j = -gridRadius; j <= gridRadius; j++) {
		for(var k = -gridRadius; k <= gridRadius; k++) {
			var pt = new THREE.Vector3(i*gridRes, j*gridRes, k*gridRes);
			var junci = Math.abs(i) % gridMaj;
			var juncj = Math.abs(j) % gridMaj;
			var junck = Math.abs(k) % gridMaj;
			if(junci < 1 && juncj < 1 && junck < 1)
				bgMajorGridGeometry.vertices.push(pt);
			//else
				//bgMinorGridGeometry.vertices.push(pt);
		}
	}
}
var bgMajorGridMaterial = new THREE.PointsMaterial({color:0xffffff, size:0.1});
//var bgMinorGridMaterial = new THREE.PointsMaterial({color:0xcccccc, size:0.01});
var bgMajorGrid = new THREE.Points(bgMajorGridGeometry, bgMajorGridMaterial);
//var bgMinorGrid = new THREE.Points(bgMinorGridGeometry, bgMinorGridMaterial);
PvwScene.add(bgMajorGrid);
//PvwScene.add(bgMinorGrid);

var gSz = gridRadius * 2 + 1;
//https://discourse.threejs.org/t/3d-grid-of-lines/3850
var bgMinorGridGeometry = new THREE.BufferGeometry();
function mapTo3DGrid(i) {
	var z = Math.floor(i / (gSz * gSz));
	i -= z * gSz * gSz;
	var y = Math.floor(i / gSz);
	var x = i % gSz;
	return { x: x, y: y, z: z };
}
function mapFrom3DGrid(x, y, z) {
	return x + y * gSz + z * gSz * gSz;
}
var positions = [];
for (var i = 0; i < gSz*gSz*gSz; i++) {
	var p = mapTo3DGrid(i);
	positions.push((p.x - gSz / 2 + 0.5) * gridRes);
	positions.push((p.y - gSz / 2 + 0.5) * gridRes);
	positions.push((p.z - gSz / 2 + 0.5) * gridRes);
}
var positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
bgMinorGridGeometry.addAttribute("position", positionAttribute);

var indexPairs = [];
for (var i = 0; i < gSz*gSz*gSz; i++) {
	var p = mapTo3DGrid(i);
	if (p.x + 1 < gSz) {
		indexPairs.push(i);
		indexPairs.push(mapFrom3DGrid(p.x + 1, p.y, p.z));
	}
	if (p.y + 1 < gSz) {
		indexPairs.push(i);
		indexPairs.push(mapFrom3DGrid(p.x, p.y + 1, p.z));
	}
	if (p.z + 1 < gSz) {
		indexPairs.push(i);
		indexPairs.push(mapFrom3DGrid(p.x, p.y, p.z + 1));
	}
}
bgMinorGridGeometry.setIndex(indexPairs);
var bgMinorGrid = new THREE.LineSegments(bgMinorGridGeometry, new THREE.LineBasicMaterial({transparent: true, opacity: 0.2}));
PvwScene.add(bgMinorGrid);



//Bind preview controls for grid object
$('#opt-previewgrid').change(function() {
	bgMajorGrid.visible = this.checked;
	bgMinorGrid.visible = this.checked;
});

//Axes object
var ah = new THREE.AxesHelper(gridRadius*gridRes);
PvwScene.add(ah);
var ahm = new THREE.AxesHelper(-gridRadius*gridRes);
ahm.material = new THREE.LineDashedMaterial({
	scale: 1,
	dashSize: 0.1,
	gapSize: 0.1,
	vertexColors: 2,
	opacity: 0.5
});
ahm.computeLineDistances();
PvwScene.add(ahm);

//Lighting
var PvwLight = new THREE.DirectionalLight(0xffffff, 1.0);
PvwScene.add(PvwLight);
var plgeom = new THREE.SphereGeometry(5);
var plmat = new THREE.MeshBasicMaterial({color: 0xffffff});
var plmesh = new THREE.Mesh(plgeom, plmat);
PvwLight.add(plmesh);

//Bind preview controls for lighting
var updatePvwLight = function() {
	var lpitch = $("#opt-lightpitch").val();
	var lyaw = $("#opt-lightyaw").val();
	var lintens = $("#opt-lightintensity").val();
	PvwLight.position.set(
		Math.cos(lyaw) * Math.cos(lpitch)*200,
		Math.sin(lyaw) * Math.cos(lpitch)*200,
		Math.sin(lpitch)*200
	);
	PvwLight.intensity = Math.pow(2, lintens);
}

$("#opt-lightpitch").on('input', updatePvwLight);
$("#opt-lightyaw").on('input', updatePvwLight);
$("#opt-lightintensity").on('input', updatePvwLight);

updatePvwLight();

//Main animation loop
var PvwAnimate = function() {
	PvwStats.begin();
	if($("#opt-livepreview").is(':checked')) {
		PvwControls.update();
		
		if(bgMajorGrid.visible) {
			var rayArgs = PvwRaycast();
			if(rayArgs.length > 0) {
				var nGPos = rayArgs[0].point;
				
				bgMinorGrid.position.set(
					Math.round(nGPos.x/gridRes)*gridRes,
					Math.round(nGPos.y/gridRes)*gridRes,
					Math.round(nGPos.z/gridRes)*gridRes
				);
				bgMajorGrid.position.set(
					Math.round(nGPos.x/gridRes/gridMaj)*gridRes*gridMaj,
					Math.round(nGPos.y/gridRes/gridMaj)*gridRes*gridMaj,
					Math.round(nGPos.z/gridRes/gridMaj)*gridRes*gridMaj
				);
			}
		}
		PvwRenderer.render(PvwScene, PvwCamera);
	}
	PvwStats.end();
	requestAnimationFrame(PvwAnimate);
}
PvwAnimate();