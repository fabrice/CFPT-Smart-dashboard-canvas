// Dashboard Hue
// Version 1


//-----------------------------------------------------------------------------
// URLs

const hue_base_ip = '10.5.63.15';
const hue_base_key = '8yO7AH4ixMnF9Tg1QZCEfwn-cn2F9LwrrlEwMP-B';

const hue_base_url = 'http://' + hue_base_ip + '/api/' + hue_base_key + '/';
const hue_lights_url = hue_base_url + 'lights';
const hue_sensors_url = hue_base_url + 'sensors';

//-----------------------------------------------------------------------------
// fetching the current state

function fetchAndRefreshLamps() {

	fetch( hue_lights_url, { method: 'GET', mode: 'cors', cache: 'no-store' } )
		.then( (response) => {
			console.log( response );
			if ( response.status != 200 ) {
				console.error( "fetch.response.status = " + response.status );
			}

			return response.json();
		} )
		.then( (json) => {
			console.log( json );

			if ( json !== undefined ) {
				for ( const key in json ) {
					let lamp_id = Number(key);
					let lamp_json = json[key];
					refreshLamp( lamp_id, lamp_json );
				}
			}
		} )
		.catch( (error) => {
			console.error( error );
		} );

}

//-----------------------------------------------------------------------------
// refresh a lamp

function refreshLamp( lamp_id, lamp_json ) {
	// can't work without data
	if ( lamp_id === undefined ) return;
	if ( lamp_json === undefined ) return;

	// can't work without a corresponding visual element
	let lamp_element = document.getElementById( 'lamp-' + lamp_id );
	if ( lamp_element === undefined ) return;

	// values

	let power = false;
	let brightness = 0;

	if ( 'state' in lamp_json ) {
		power = lamp_json.state.on;
		brightness = lamp_json.state.bri;
	}

	// border color
	lamp_element.style.borderColor = (power) ? "green" : "black";

	// lamp color
	lamp_element.style.backgroundColor = (power) ? "white" : "black";

	console.log( "lamp " + lamp_id + " => power : " + power + ", brightness : " + brightness );
}


//-----------------------------------------------------------------------------
// library : colors, timers

// color conversions

//---------------------------------------------------------
// CIEtoRGBWeb
// basically CIEtoRGB, with some tweaks to look better
function CIEtoRGBWeb( x, y, bri100 ) {
	return CIEtoRGB( x, y, bri100 * 80 / 100 + 20 );
}

//---------------------------------------------------------
// CIEtoRGB
// input : x, y, brightness 0..100
// output : { red, green, blue } 0..255
// link : https://github.com/usolved/cie-rgb-converter/blob/master/cie_rgb_converter.js
function CIEtoRGB( x, y, bri100 ) {
	if ( bri100 === undefined ) {
		bri100 = 100;
	}

	let z = 1.0 - x - y;
	var Y = (bri100 / 100).toFixed(2);
	var X = (Y / y) * x;
	var Z = (Y / y) * z;

	//Convert to RGB using Wide RGB D65 conversion
	var red =  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
	var green = - X * 0.707196 + Y * 1.655397 + Z * 0.036152;
	var blue =  X * 0.051713 - Y * 0.121364 + Z * 1.011530;

	//If red, green or blue is larger than 1.0 set it back to the maximum of 1.0
	if ( (red > blue) && (red > green) && (red > 1.0) ) {
		green = green / red;
		blue = blue / red;
		red = 1.0;
	}
	else if ( (green > blue) && (green > red) && (green > 1.0) ) {
		red = red / green;
		blue = blue / green;
		green = 1.0;
	}
	else if ( (blue > red) && (blue > green) && (blue > 1.0) ) {
		red = red / blue;
		green = green / blue;
		blue = 1.0;
	}

	if ( 1 ) {
	//Reverse gamma correction
	red = (red <= 0.0031308) ? 12.92 * red : (1.0 + 0.055) * Math.pow(red, (1.0 / 2.4)) - 0.055;
	green = (green <= 0.0031308) ? 12.92 * green : (1.0 + 0.055) * Math.pow(green, (1.0 / 2.4)) - 0.055;
	blue = (blue <= 0.0031308) ? 12.92 * blue : (1.0 + 0.055) * Math.pow(blue, (1.0 / 2.4)) - 0.055;
	}

	//Convert normalized decimal to decimal
	red = Math.round( red * 255 );
	green = Math.round( green * 255 );
	blue = Math.round( blue * 255 );

	if ( isNaN( red ) ) red = 0;
	if ( isNaN( green ) ) green = 0;
	if ( isNaN( blue ) ) blue = 0;

	return { red: red, green: green, blue: blue };
}

//---------------------------------------------------------
// RGBtoHSBL
// input : red 0..255, green 0..255, blue 0..255
// output : { hue, saturation, brightness, lightness }
function RGBtoHSBL( r255, g255, b255 ) {
	let r1 = r255 / 255;
	let g1 = g255 / 255;
	let b1 = b255 / 255;

	let cmax = Math.max( r1, g1, b1 );
	let cmin = Math.min( r1, g1, b1 );
	let delta = cmax - cmin;

	let hue = 0;
	if ( cmax == r1 ) {
		hue = ((g1 - b1) / delta) % 6;
	}
	else if ( cmax == g1 ) {
		hue = ((b1 - r1) / delta) + 2;
	}
	else if ( cmax == b1 ) {
		hue = ((r1 - g1) / delta) + 4;
	}
	hue *= 60;
	hue %= 360;

	let sat = 0;
	if ( cmax != 0 ) {
		sat = delta / cmax;
	}
	sat *= 100;

	let bri = cmax;
	bri *= 100;

	let lit = (cmax + cmin) / 2;
	lit *= 100;

	console.log( "hue: " + hue + " saturation: " + sat + " brightness: " + bri + " lightness: " + lit );

	return { hue: hue, saturation: sat, brightness: bri, lightness: lit };
}

//---------------------------------------------------------
// HSBtoRGB
// input : hue, saturation 0..100, brightness 0..100
// output : { red, green, blue } 0..255
function HSBtoRGB( hue, sat100, bri100 ) {
	let sat1 = sat100 / 100;
	let bri1 = bri100 / 100;

	let chroma = bri1 * sat1;
	let H = hue / 60;
	let X = chroma * (1 - Math.abs( H % 2 - 1 ));
	let r1 = 0;
	let g1 = 0;
	let b1 = 0;
	if ( (H >= 0) && (H <= 1) ) {
		r1 = C;
		g1 = X;
		b1 = 0;
	}
	else if ( (H > 1) && (H <= 2) ) {
		r1 = X;
		g1 = C;
		b1 = 0;
	}
	else if ( (H > 2) && (H <= 3) ) {
		r1 = 0;
		g1 = C;
		b1 = X;
	}
	else if ( (H > 3) && (H <= 4) ) {
		r1 = 0;
		g1 = X;
		b1 = C;
	}
	else if ( (H > 4) && (H <= 5) ) {
		r1 = X;
		g1 = 0;
		b1 = C;
	}
	else if ( (H > 5) && (H <= 6) ) {
		r1 = C;
		g1 = 0;
		b1 = X;
	}
	else {
		r1 = 0;
		g1 = 0;
		b1 = 0;
	}
	let m = bri1 - C;
	r1 += m;
	g1 += m;
	b1 += m;

	return { red: r1 * 255, green: g1 * 255, blue: b1 * 255 };
}

//---------------------------------------------------------
// HSLtoRGB
// input : hue, saturation 0..100, lightness 0..100
// output : { red, green, blue } 0..255
function HSLtoRGB( hue, sat100, lit100 ) {
	let sat1 = sat100 / 100;
	let lit1 = lit100 / 100;

	let chroma = (1 - Math.abs( 2 * lit1 - 1 )) * sat1;
	let H = hue / 60;
	let X = chroma * (1 - Math.abs( H % 2 - 1 ));
	let r1 = 0;
	let g1 = 0;
	let b1 = 0;
	if ( (H >= 0) && (H <= 1) ) {
		r1 = C;
		g1 = X;
		b1 = 0;
	}
	else if ( (H >= 1) && (H <= 2) ) {
		r1 = X;
		g1 = C;
		b1 = 0;
	}
	else if ( (H >= 2) && (H <= 3) ) {
		r1 = 0;
		g1 = C;
		b1 = X;
	}
	else if ( (H >= 3) && (H <= 4) ) {
		r1 = 0;
		g1 = X;
		b1 = C;
	}
	else if ( (H >= 4) && (H <= 5) ) {
		r1 = X;
		g1 = 0;
		b1 = C;
	}
	else if ( (H >= 5) && (H <= 6) ) {
		r1 = C;
		g1 = 0;
		b1 = X;
	}
	else {
		r1 = 0;
		g1 = 0;
		b1 = 0;
	}
	let m = lit1 - C / 2;
	r1 += m;
	g1 += m;
	b1 += m;

	return { red: r1 * 255, green: g1 * 255, blue: b1 * 255 };
}

//---------------------------------------------------------
// color string 00..FF

function int8toHex( byte ) {
	if ( byte === undefined ) byte = 0;
	if ( byte > 255 ) byte = 255;

	let hex = Math.round(Number( byte )).toString(16 );
	if ( hex.length < 2 ) {
		hex = "0" + hex;
	}

	return hex;
}

//---------------------------------------------------------
// color string #000000..#FFFFFF

function colorComponentsToHex( r, g, b ) {
	let red = int8toHex( r );
	let green = int8toHex( g );
	let blue = int8toHex( b );

	return "#" + red + green + blue;
}

//---------------------------------------------------------

// timer

//---------------------------------------------------------
// fetchAndRefreshLamps will be called every S seconds for M minutes

function callFetchAndRefreshLamps() {

	execution_counter += 1;
	if ( (execution_counter > execution_count) && (refresher !== undefined) ) {
		console.log("Automatic refresh suspended after " + execution_counter + " refreshes.\nReload to restart.")
		window.clearTimeout( refresher );
		delete refresher;
		execution_counter = 0;

		let lamp_json = { "id": 1, "state": { "on": false, "bri": 255} };
		let lamp_id = 0;
		for ( lamp_id = 1; lamp_id <= 3 ; ++lamp_id ) {
			lamp_json.id = lamp_id;
			refreshLamp( lamp_id, lamp_json );
		}

		return;
	}

	fetchAndRefreshLamps();
}

//---------------------------------------------------------
// refresh every x seconds

const interval = 2 * 1000; // 2 secondes
var execution_count = (60 * 60) / (interval / 1000); // 60 minutes
//execution_count = 1; // 60 minutes
var execution_counter = 0;

var refresher = window.setInterval( callFetchAndRefreshLamps, interval );

//---------------------------------------------------------

// events

//---------------------------------------------------------
// lampClicked will be called when a lamp is clicked

function lampClicked( lamp_element ) {
	let lamp_id = lamp_element.id;
	console.log( "Lamp " + lamp_id + " clicked." );

	if ( lamp_id === "lamp-1" ) {
	}
	else if ( lamp_id === "lamp-2" ) {
	}
	else if ( lamp_id === "lamp-3" ) {
	}
	else {
		console.log( "lampClicked called - unexpected lamp " + lamp_id + " clicked." );
	}
}

//-----------------------------------------------------------------------------
