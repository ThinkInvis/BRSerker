//brickdata.js
//contains all sorts of mappers for BLS/BRS brick data, as well as an internal representation

var ToBlsBasicName = function(x,y,z) {
	//TODO: these are for BLS2BRS compatibility and can be removed once BRS writer is in here
	if(x > MASTER_SX_LIMIT) x = MASTER_SX_LIMIT;
	if(y > MASTER_SY_LIMIT) y = MASTER_SY_LIMIT;
	if(z > MASTER_SZ_LIMIT) z = MASTER_SZ_LIMIT;
	
	//match cubes:
	if(x > 1 && x == y && x == z && isPow2(x)) {
		return {Name: x + "x Cube", Rotation: 0};
	}
	
	//match normal brick sizes:
	var zstr;
	if(z == 1) {
		zstr = "f";
	} else if((z % 3) == 0) {
		if(z == 3)
			zstr = "";
		else
			zstr = "x" + (z/3).toFixed(0);
	} else {
		zstr = "x" + z + "f"; //this is decidedly NOT vanilla but w/e
	}
	if(x <= y)
		return {Name: x + "x" + y + zstr, Rotation: 0};
	else
		return {Name: y + "x" + x + zstr, Rotation: 1};
}

var BasicFromBlsName = function(name) {
	var szww = name.split(" ");
	var szw = szww[0].split("x");
		
		
	//match cubes:
	if(szww[1] == "Cube") { //excludes zone cubes
		return {
			SizeX: szw[0]*1,
			SizeY: szw[0]*1,
			SizeZ: szw[0]*3,
			Name: "Basic",
			Orientation: 4,
			AddRot: 0
		}
	}
	
	//match all roads and baseplates:
	if(szww[1] == "Road" || szww[1] == "Base") {
		return {
			SizeX: szw[0]*1,
			SizeY: szw[1]*1,
			SizeZ: 1,
			Name: "Basic",
			Orientation: 4,
			AddRot: 0
		}
	}
	
	//TODO: [size] Arch [Up]: 1x3, 1x4, 1x5(always x2), 1x6x1, 1x6x2, 1x8(always x3)
	
	//match ramps:
	//[-?][angle]° Ramp [1x, 2x, 4x, Corner, 2x Print]"
	//ysize+zsize depends on angle:
	//25: y3 z1
	//45: y2 z1
	//72: y2 z3
	//80: y2 z5
	//ramp ALWAYS has one stud at the top of the ramp, and a ~0.5f lip
	//corner is always ysize*ysize
	if(szww[1] == "Ramp") {
		var angle = szww[0].substring(szww[0].length-3, szww[0].length-1);
		var rx, ry, rz, rt;
		if(angle == "25") {
			ry = 3;
			rz = 3;
		} else if(angle == "45") {
			ry = 2;
			rz = 3;
		} else if(angle == "72") {
			ry = 2;
			rz = 9;
		} else if(angle == "80") {
			ry = 2;
			rz = 15;
		} else return;
		var invert = szww[0].substring(0, 1) == "-";
		if(szww[2] == "Corner") {
			rx = ry;
			rt = "RampCorner";
		} else {
			rx = szww[2].slice(0,-1) * 1;
			rt = "Ramp";
		}
		return {
			SizeX: rx,
			SizeY: ry,
			SizeZ: rz,
			Name: rt,
			Orientation: (invert ? 5 : 4),
			AddRot: 0
		};
	}
	
	//match crests:
	//[25, 45]° Crest [4x, 2x, 1x, End, Corner]
	//25degr is 2f tall, 45degr is 3f tall
	//end is 1x2, corner is 2x2
	
	//specials:
	//"2x2 Corner", "Pine Tree"/"Christmas Tree" 6x6x(7+1f), "8x8 Grill" 8x8x1f, "Castle Wall" 1x3x6, "1x4x5 Window", "2x2x5 Lattice", "1x4x2 Fence", "1x4x2 Bars", "1x4x2 Picket", "Skull" 1x1, "Coffin Standing" ???, "Coffin" ???, "Pumpkin" ???, "Gravestone" ???, "Music Brick" 1x1, "Spawn Point"/"Checkpoint" 3x3x5, "Vehicle Spawn" 8x8f, "Treasure Chest" ???, "Teledoor" ???, "House/Glassiest/Window/Jail/Plain Door" 1x4x6, 
	
	//match normal brick sizes, prints, non-arch rounds:
	if((szww.length == 1 || szww[1] == "Print" || szww[1] == "Disc" || szww[1] == "Round" || szww[1] == "Cone") && szww[0].includes("x")) {
		if(szw.length > 2) {
			if(szww[0].slice(-1) == "F")
				szw[2] = szw[2].slice(0, -1);
			else
				szw[2] = szw[2] * 3;
		} else if(szww[0].slice(-1) == "F") {
			szw[1] = szw[1].slice(0,-1);
			szw[2] = 1;
		} else
			szw[2] = 3;
		
		//1x2f prints are weird
		if(name == "1x2F Print") {
			var s3 = szw[1];
			szw[1] = szw[0];
			szw[0] = s3;
		}
		
		var bn = "Basic";
		if(szww[1] == "Disc") {
			bn = "Cone"; //TODO: this is actually 3x3 instead of 2x2, but the offset from bls files works out here. might not always work out, so we should find a way to add a custom XYZ scale instead
			szw[2] /= 3;
		}
		if(szww[1] == "Round" || szww[1] == "Cone")
			bn = szww[1];
		
		return {
			SizeX: szw[0]*1,
			SizeY: szw[1]*1,
			SizeZ: szw[2]*1,
			Name: bn,
			Orientation: 4,
			AddRot: 0
		}
	}
}

//WIP, ensures only vanilla bricks instead of just matching general name patterns
var ToBlsVanillaBasicName = function(x,y,z) {
	if(x >= 1 && y == 1 && z == 1 && x <= 12) {
		return {Name: "1x" + x + "f", Rotation: 0};
	}
	if(x == 1 && y > 1 && z == 1 && y <= 12) {
		return {Name: "1x" + x + "f", Rotation: 1};
	}
	if(x == 1 && y == 1 && z > 1 && (z % 3) == 0 && z < 16) {
		return {Name: "1x1x" + Math.floor(z/3), Rotation: 0};
	}
	return {Name: "Unknown", Rotation: 0};
}



var blsColorsetRGB = [
	[0.898039, 0.000000, 0.000000, 1.000000],
	[0.898039, 0.898039, 0.000000, 1.000000],
	[0.000000, 0.498039, 0.247059, 1.000000],
	[0.200000, 0.000000, 0.800000, 1.000000],
	[0.898039, 0.898039, 0.898039, 1.000000],
	[0.749020, 0.749020, 0.749020, 1.000000],
	[0.498039, 0.498039, 0.498039, 1.000000],
	[0.200000, 0.200000, 0.200000, 1.000000],
	[0.392157, 0.192157, 0.000000, 1.000000],
	[0.901961, 0.337255, 0.078431, 1.000000],
	[0.749020, 0.176471, 0.482353, 1.000000],
	[0.384314, 0.000000, 0.113725, 1.000000],
	[0.129412, 0.266667, 0.266667, 1.000000],
	[0.000000, 0.137255, 0.329412, 1.000000],
	[0.101961, 0.458824, 0.764706, 1.000000],
	[1.000000, 1.000000, 1.000000, 1.000000],
	[0.078431, 0.078431, 0.078431, 1.000000],
	[1.000000, 1.000000, 1.000000, 0.247059],
	[0.921569, 0.513726, 0.674510, 1.000000],
	[1.000000, 0.603922, 0.419608, 1.000000],
	[1.000000, 0.874510, 0.611765, 1.000000],
	[0.956863, 0.874510, 0.784314, 1.000000],
	[0.784314, 0.921569, 0.486275, 1.000000],
	[0.537255, 0.694118, 0.549020, 1.000000],
	[0.556863, 0.929412, 0.956863, 1.000000],
	[0.694118, 0.658824, 0.901961, 1.000000],
	[0.874510, 0.556863, 0.956863, 1.000000],
	[0.666667, 0.000000, 0.000000, 0.698039],
	[1.000000, 0.498039, 0.000000, 0.698039],
	[0.988235, 0.956863, 0.000000, 0.698039],
	[0.000000, 0.470588, 0.192157, 0.698039],
	[0.000000, 0.200000, 0.639216, 0.698039],
	[0.592157, 0.156863, 0.392157, 0.694118],
	[0.549020, 0.698039, 1.000000, 0.698039],
	[0.847059, 0.847059, 0.847059, 0.698039],
	[0.098039, 0.098039, 0.098039, 0.698039],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000],
	[1.000000, 0.000000, 1.000000, 0.000000]
];


var brsColorsetHex = [[0xffffff,0xc1c1c1,0xa0a0a0,0x828282,0x686868,0x494949,0x2c2c2c,0x000000]
   ,[0x9e2835,0xf62a2a,0xfb922b,0xf6ce2a,0x34c328,0x25cbd6,0xd1689c,0xa14b80]
   ,[0x542615,0x7a5040,0xa04726,0xc6854b,0xd3ab87,0xffcf96,0xe2d183,0xffd877]
   ,[0x284c27,0x28611b,0x526a07,0x009500,0x3b7f3a,0x8c983e,0xffc73a,0xaf8928]
   ,[0x3a6173,0x616d70,0x90a2a5,0xbed6db,0x98c8d1,0x33b5e5,0x008ab8,0x0d6689]];
   
var brsColorHexOpacity = [[1, 1, 1, 1, 1, 1, 1, 1]
   ,[1, 1, 1, 1, 1, 1, 1, 1]
   ,[1, 1, 1, 1, 1, 1, 1, 1]
   ,[1, 1, 1, 1, 1, 1, 1, 1]
   ,[1, 1, 1, 1, 1, 1, 1, 1]];
   //TODO: transparent sets
   
var brsColorsetRGB = [];
for(var i = 0; i < brsColorsetHex.length; i++) {
	for(var j = 0; j < brsColorsetHex[i].length; j++) {
		var nc = Colour.HEX2RGBA(brsColorsetHex[i][j]);
		brsColorsetRGB.push([nc[0]/255, nc[1]/255, nc[2]/255, brsColorHexOpacity[i][j]]);
	}
}




class InternalBrick {
	//bbox: THREE.Vector3 representing the bounding box size of the brick
	//pos: THREE.Vector3 representing the position of the back-lower-left corner of the brick
	//rot: rotation index (0, 1, 2, 3)
	//clr: 0xABCDEF
	//mtl: material index (0, 1, 2, 3, may change based on Brickadia development)
	constructor(bbox, pos, rot, clr, mtl, {
		InternalName = "",
		Orientation = 4,
		BrickadiaName = "",
		BlocklandName = "",
		BrickadiaData = {},
		BlocklandData = {},
		Visible = true,
		Collides = true
	} = {}) {
		//TODO: more advanced construction, e.g. wedges; loading from meshes
		this.BoundingBox = bbox.clone();
		this.Position = pos.clone();
		//this.CenterPosition = bbox.clone().divideScalar(2).add(pos);
		this.RotationIndex = rot;
		this.FacingIndex = Orientation;
		this.Color = clr;
		this.MaterialIndex = mtl;
		this.IntRef = InternalName;
		this.BrsRef = BrickadiaName;
		this.BlsRef = BlocklandName;
		this.BrsData = BrickadiaData;
		this.BlsData = BlocklandData;
		this.Rendering = Visible;
		this.Collision = Collides;
	}
	
	AutoOffset() {
		this.Position.addScaledVector(this.BoundingBox, 0.5);
		return this;
	}
}