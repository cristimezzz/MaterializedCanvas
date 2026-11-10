// ==UserScript==
// @name         Materialized Canvas
// @namespace    https://github.com/materialized-canvas
// @version      0.4.0
// @description  为上海交通大学 Canvas (oc.sjtu.edu.cn) 换上 Material Design 3 外观，支持自选主色与深色模式
// @icon         https://oc.sjtu.edu.cn/favicon.ico
// @match        https://oc.sjtu.edu.cn/*
// @connect      self
// @connect      *
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
	"use strict";
	var _GM_deleteValue = (() => typeof GM_deleteValue != "undefined" ? GM_deleteValue : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_registerMenuCommand = (() => typeof GM_registerMenuCommand != "undefined" ? GM_registerMenuCommand : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var _GM_xmlhttpRequest = (() => typeof GM_xmlhttpRequest != "undefined" ? GM_xmlhttpRequest : void 0)();
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var DEFAULTS = {
		enabled: true,
		seed: "#C8161E",
		mode: "system",
		contrast: 0,
		darkUserContent: true
	};
	var PRESETS = [
		{
			name: "交大红",
			color: "#C8161E"
		},
		{
			name: "海洋蓝",
			color: "#0B57D0"
		},
		{
			name: "森林绿",
			color: "#146C2E"
		},
		{
			name: "紫罗兰",
			color: "#6750A4"
		},
		{
			name: "琥珀橙",
			color: "#B35A00"
		},
		{
			name: "青碧",
			color: "#006A6A"
		},
		{
			name: "樱粉",
			color: "#B4235B"
		},
		{
			name: "石墨",
			color: "#5B5F63"
		}
	];
	var KEY$1 = "settings";
	function loadSettings() {
		const saved = _GM_getValue(KEY$1, {});
		return {
			...DEFAULTS,
			...saved
		};
	}
	function saveSettings(s) {
		_GM_setValue(KEY$1, s);
	}
	function signum(num) {
		if (num < 0) return -1;
		else if (num === 0) return 0;
		else return 1;
	}
	function lerp(start, stop, amount) {
		return (1 - amount) * start + amount * stop;
	}
	function clampInt(min, max, input) {
		if (input < min) return min;
		else if (input > max) return max;
		return input;
	}
	function clampDouble(min, max, input) {
		if (input < min) return min;
		else if (input > max) return max;
		return input;
	}
	function sanitizeDegreesInt(degrees) {
		degrees = degrees % 360;
		if (degrees < 0) degrees = degrees + 360;
		return degrees;
	}
	function sanitizeDegreesDouble(degrees) {
		degrees = degrees % 360;
		if (degrees < 0) degrees = degrees + 360;
		return degrees;
	}
	function rotationDirection(from, to) {
		return sanitizeDegreesDouble(to - from) <= 180 ? 1 : -1;
	}
	function differenceDegrees(a, b) {
		return 180 - Math.abs(Math.abs(a - b) - 180);
	}
	function matrixMultiply(row, matrix) {
		return [
			row[0] * matrix[0][0] + row[1] * matrix[0][1] + row[2] * matrix[0][2],
			row[0] * matrix[1][0] + row[1] * matrix[1][1] + row[2] * matrix[1][2],
			row[0] * matrix[2][0] + row[1] * matrix[2][1] + row[2] * matrix[2][2]
		];
	}
	var SRGB_TO_XYZ = [
		[
			.41233895,
			.35762064,
			.18051042
		],
		[
			.2126,
			.7152,
			.0722
		],
		[
			.01932141,
			.11916382,
			.95034478
		]
	];
	var XYZ_TO_SRGB = [
		[
			3.2413774792388685,
			-1.5376652402851851,
			-.49885366846268053
		],
		[
			-.9691452513005321,
			1.8758853451067872,
			.04156585616912061
		],
		[
			.05562093689691305,
			-.20395524564742123,
			1.0571799111220335
		]
	];
	var WHITE_POINT_D65 = [
		95.047,
		100,
		108.883
	];
	function argbFromRgb(red, green, blue) {
		return (255 << 24 | (red & 255) << 16 | (green & 255) << 8 | blue & 255) >>> 0;
	}
	function argbFromLinrgb(linrgb) {
		return argbFromRgb(delinearized(linrgb[0]), delinearized(linrgb[1]), delinearized(linrgb[2]));
	}
	function redFromArgb(argb) {
		return argb >> 16 & 255;
	}
	function greenFromArgb(argb) {
		return argb >> 8 & 255;
	}
	function blueFromArgb(argb) {
		return argb & 255;
	}
	function argbFromXyz(x, y, z) {
		const matrix = XYZ_TO_SRGB;
		const linearR = matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z;
		const linearG = matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z;
		const linearB = matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z;
		return argbFromRgb(delinearized(linearR), delinearized(linearG), delinearized(linearB));
	}
	function xyzFromArgb(argb) {
		return matrixMultiply([
			linearized(redFromArgb(argb)),
			linearized(greenFromArgb(argb)),
			linearized(blueFromArgb(argb))
		], SRGB_TO_XYZ);
	}
	function labFromArgb(argb) {
		const linearR = linearized(redFromArgb(argb));
		const linearG = linearized(greenFromArgb(argb));
		const linearB = linearized(blueFromArgb(argb));
		const matrix = SRGB_TO_XYZ;
		const x = matrix[0][0] * linearR + matrix[0][1] * linearG + matrix[0][2] * linearB;
		const y = matrix[1][0] * linearR + matrix[1][1] * linearG + matrix[1][2] * linearB;
		const z = matrix[2][0] * linearR + matrix[2][1] * linearG + matrix[2][2] * linearB;
		const whitePoint = WHITE_POINT_D65;
		const xNormalized = x / whitePoint[0];
		const yNormalized = y / whitePoint[1];
		const zNormalized = z / whitePoint[2];
		const fx = labF(xNormalized);
		const fy = labF(yNormalized);
		const fz = labF(zNormalized);
		return [
			116 * fy - 16,
			500 * (fx - fy),
			200 * (fy - fz)
		];
	}
	function argbFromLstar(lstar) {
		const component = delinearized(yFromLstar(lstar));
		return argbFromRgb(component, component, component);
	}
	function lstarFromArgb(argb) {
		const y = xyzFromArgb(argb)[1];
		return 116 * labF(y / 100) - 16;
	}
	function yFromLstar(lstar) {
		return 100 * labInvf((lstar + 16) / 116);
	}
	function lstarFromY(y) {
		return labF(y / 100) * 116 - 16;
	}
	function linearized(rgbComponent) {
		const normalized = rgbComponent / 255;
		if (normalized <= .040449936) return normalized / 12.92 * 100;
		else return Math.pow((normalized + .055) / 1.055, 2.4) * 100;
	}
	function delinearized(rgbComponent) {
		const normalized = rgbComponent / 100;
		let delinearized = 0;
		if (normalized <= .0031308) delinearized = normalized * 12.92;
		else delinearized = 1.055 * Math.pow(normalized, 1 / 2.4) - .055;
		return clampInt(0, 255, Math.round(delinearized * 255));
	}
	function whitePointD65() {
		return WHITE_POINT_D65;
	}
	function labF(t) {
		const e = 216 / 24389;
		const kappa = 24389 / 27;
		if (t > e) return Math.pow(t, 1 / 3);
		else return (kappa * t + 16) / 116;
	}
	function labInvf(ft) {
		const e = 216 / 24389;
		const kappa = 24389 / 27;
		const ft3 = ft * ft * ft;
		if (ft3 > e) return ft3;
		else return (116 * ft - 16) / kappa;
	}
	var ViewingConditions = class ViewingConditions {
		static make(whitePoint = whitePointD65(), adaptingLuminance = 200 / Math.PI * yFromLstar(50) / 100, backgroundLstar = 50, surround = 2, discountingIlluminant = false) {
			const xyz = whitePoint;
			const rW = xyz[0] * .401288 + xyz[1] * .650173 + xyz[2] * -.051461;
			const gW = xyz[0] * -.250268 + xyz[1] * 1.204414 + xyz[2] * .045854;
			const bW = xyz[0] * -.002079 + xyz[1] * .048952 + xyz[2] * .953127;
			const f = .8 + surround / 10;
			const c = f >= .9 ? lerp(.59, .69, (f - .9) * 10) : lerp(.525, .59, (f - .8) * 10);
			let d = discountingIlluminant ? 1 : f * (1 - 1 / 3.6 * Math.exp((-adaptingLuminance - 42) / 92));
			d = d > 1 ? 1 : d < 0 ? 0 : d;
			const nc = f;
			const rgbD = [
				d * (100 / rW) + 1 - d,
				d * (100 / gW) + 1 - d,
				d * (100 / bW) + 1 - d
			];
			const k = 1 / (5 * adaptingLuminance + 1);
			const k4 = k * k * k * k;
			const k4F = 1 - k4;
			const fl = k4 * adaptingLuminance + .1 * k4F * k4F * Math.cbrt(5 * adaptingLuminance);
			const n = yFromLstar(backgroundLstar) / whitePoint[1];
			const z = 1.48 + Math.sqrt(n);
			const nbb = .725 / Math.pow(n, .2);
			const ncb = nbb;
			const rgbAFactors = [
				Math.pow(fl * rgbD[0] * rW / 100, .42),
				Math.pow(fl * rgbD[1] * gW / 100, .42),
				Math.pow(fl * rgbD[2] * bW / 100, .42)
			];
			const rgbA = [
				400 * rgbAFactors[0] / (rgbAFactors[0] + 27.13),
				400 * rgbAFactors[1] / (rgbAFactors[1] + 27.13),
				400 * rgbAFactors[2] / (rgbAFactors[2] + 27.13)
			];
			const aw = (2 * rgbA[0] + rgbA[1] + .05 * rgbA[2]) * nbb;
			return new ViewingConditions(n, aw, nbb, ncb, c, nc, rgbD, fl, Math.pow(fl, .25), z);
		}
		constructor(n, aw, nbb, ncb, c, nc, rgbD, fl, fLRoot, z) {
			this.n = n;
			this.aw = aw;
			this.nbb = nbb;
			this.ncb = ncb;
			this.c = c;
			this.nc = nc;
			this.rgbD = rgbD;
			this.fl = fl;
			this.fLRoot = fLRoot;
			this.z = z;
		}
	};
	ViewingConditions.DEFAULT = ViewingConditions.make();
	var Cam16 = class Cam16 {
		constructor(hue, chroma, j, q, m, s, jstar, astar, bstar) {
			this.hue = hue;
			this.chroma = chroma;
			this.j = j;
			this.q = q;
			this.m = m;
			this.s = s;
			this.jstar = jstar;
			this.astar = astar;
			this.bstar = bstar;
		}
		distance(other) {
			const dJ = this.jstar - other.jstar;
			const dA = this.astar - other.astar;
			const dB = this.bstar - other.bstar;
			const dEPrime = Math.sqrt(dJ * dJ + dA * dA + dB * dB);
			return 1.41 * Math.pow(dEPrime, .63);
		}
		static fromInt(argb) {
			return Cam16.fromIntInViewingConditions(argb, ViewingConditions.DEFAULT);
		}
		static fromIntInViewingConditions(argb, viewingConditions) {
			const red = (argb & 16711680) >> 16;
			const green = (argb & 65280) >> 8;
			const blue = argb & 255;
			const redL = linearized(red);
			const greenL = linearized(green);
			const blueL = linearized(blue);
			const x = .41233895 * redL + .35762064 * greenL + .18051042 * blueL;
			const y = .2126 * redL + .7152 * greenL + .0722 * blueL;
			const z = .01932141 * redL + .11916382 * greenL + .95034478 * blueL;
			const rC = .401288 * x + .650173 * y - .051461 * z;
			const gC = -.250268 * x + 1.204414 * y + .045854 * z;
			const bC = -.002079 * x + .048952 * y + .953127 * z;
			const rD = viewingConditions.rgbD[0] * rC;
			const gD = viewingConditions.rgbD[1] * gC;
			const bD = viewingConditions.rgbD[2] * bC;
			const rAF = Math.pow(viewingConditions.fl * Math.abs(rD) / 100, .42);
			const gAF = Math.pow(viewingConditions.fl * Math.abs(gD) / 100, .42);
			const bAF = Math.pow(viewingConditions.fl * Math.abs(bD) / 100, .42);
			const rA = signum(rD) * 400 * rAF / (rAF + 27.13);
			const gA = signum(gD) * 400 * gAF / (gAF + 27.13);
			const bA = signum(bD) * 400 * bAF / (bAF + 27.13);
			const a = (11 * rA + -12 * gA + bA) / 11;
			const b = (rA + gA - 2 * bA) / 9;
			const u = (20 * rA + 20 * gA + 21 * bA) / 20;
			const p2 = (40 * rA + 20 * gA + bA) / 20;
			const hue = sanitizeDegreesDouble(Math.atan2(b, a) * 180 / Math.PI);
			const hueRadians = hue * Math.PI / 180;
			const ac = p2 * viewingConditions.nbb;
			const j = 100 * Math.pow(ac / viewingConditions.aw, viewingConditions.c * viewingConditions.z);
			const q = 4 / viewingConditions.c * Math.sqrt(j / 100) * (viewingConditions.aw + 4) * viewingConditions.fLRoot;
			const huePrime = hue < 20.14 ? hue + 360 : hue;
			const t = 5e4 / 13 * (.25 * (Math.cos(huePrime * Math.PI / 180 + 2) + 3.8)) * viewingConditions.nc * viewingConditions.ncb * Math.sqrt(a * a + b * b) / (u + .305);
			const alpha = Math.pow(t, .9) * Math.pow(1.64 - Math.pow(.29, viewingConditions.n), .73);
			const c = alpha * Math.sqrt(j / 100);
			const m = c * viewingConditions.fLRoot;
			const s = 50 * Math.sqrt(alpha * viewingConditions.c / (viewingConditions.aw + 4));
			const jstar = (1 + 100 * .007) * j / (1 + .007 * j);
			const mstar = 1 / .0228 * Math.log(1 + .0228 * m);
			const astar = mstar * Math.cos(hueRadians);
			const bstar = mstar * Math.sin(hueRadians);
			return new Cam16(hue, c, j, q, m, s, jstar, astar, bstar);
		}
		static fromJch(j, c, h) {
			return Cam16.fromJchInViewingConditions(j, c, h, ViewingConditions.DEFAULT);
		}
		static fromJchInViewingConditions(j, c, h, viewingConditions) {
			const q = 4 / viewingConditions.c * Math.sqrt(j / 100) * (viewingConditions.aw + 4) * viewingConditions.fLRoot;
			const m = c * viewingConditions.fLRoot;
			const alpha = c / Math.sqrt(j / 100);
			const s = 50 * Math.sqrt(alpha * viewingConditions.c / (viewingConditions.aw + 4));
			const hueRadians = h * Math.PI / 180;
			const jstar = (1 + 100 * .007) * j / (1 + .007 * j);
			const mstar = 1 / .0228 * Math.log(1 + .0228 * m);
			const astar = mstar * Math.cos(hueRadians);
			const bstar = mstar * Math.sin(hueRadians);
			return new Cam16(h, c, j, q, m, s, jstar, astar, bstar);
		}
		static fromUcs(jstar, astar, bstar) {
			return Cam16.fromUcsInViewingConditions(jstar, astar, bstar, ViewingConditions.DEFAULT);
		}
		static fromUcsInViewingConditions(jstar, astar, bstar, viewingConditions) {
			const a = astar;
			const b = bstar;
			const m = Math.sqrt(a * a + b * b);
			const c = (Math.exp(m * .0228) - 1) / .0228 / viewingConditions.fLRoot;
			let h = Math.atan2(b, a) * (180 / Math.PI);
			if (h < 0) h += 360;
			const j = jstar / (1 - (jstar - 100) * .007);
			return Cam16.fromJchInViewingConditions(j, c, h, viewingConditions);
		}
		toInt() {
			return this.viewed(ViewingConditions.DEFAULT);
		}
		viewed(viewingConditions) {
			const alpha = this.chroma === 0 || this.j === 0 ? 0 : this.chroma / Math.sqrt(this.j / 100);
			const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(.29, viewingConditions.n), .73), 1 / .9);
			const hRad = this.hue * Math.PI / 180;
			const eHue = .25 * (Math.cos(hRad + 2) + 3.8);
			const ac = viewingConditions.aw * Math.pow(this.j / 100, 1 / viewingConditions.c / viewingConditions.z);
			const p1 = eHue * (5e4 / 13) * viewingConditions.nc * viewingConditions.ncb;
			const p2 = ac / viewingConditions.nbb;
			const hSin = Math.sin(hRad);
			const hCos = Math.cos(hRad);
			const gamma = 23 * (p2 + .305) * t / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
			const a = gamma * hCos;
			const b = gamma * hSin;
			const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
			const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
			const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
			const rCBase = Math.max(0, 27.13 * Math.abs(rA) / (400 - Math.abs(rA)));
			const rC = signum(rA) * (100 / viewingConditions.fl) * Math.pow(rCBase, 1 / .42);
			const gCBase = Math.max(0, 27.13 * Math.abs(gA) / (400 - Math.abs(gA)));
			const gC = signum(gA) * (100 / viewingConditions.fl) * Math.pow(gCBase, 1 / .42);
			const bCBase = Math.max(0, 27.13 * Math.abs(bA) / (400 - Math.abs(bA)));
			const bC = signum(bA) * (100 / viewingConditions.fl) * Math.pow(bCBase, 1 / .42);
			const rF = rC / viewingConditions.rgbD[0];
			const gF = gC / viewingConditions.rgbD[1];
			const bF = bC / viewingConditions.rgbD[2];
			return argbFromXyz(1.86206786 * rF - 1.01125463 * gF + .14918677 * bF, .38752654 * rF + .62144744 * gF - .00897398 * bF, -.0158415 * rF - .03412294 * gF + 1.04996444 * bF);
		}
		static fromXyzInViewingConditions(x, y, z, viewingConditions) {
			const rC = .401288 * x + .650173 * y - .051461 * z;
			const gC = -.250268 * x + 1.204414 * y + .045854 * z;
			const bC = -.002079 * x + .048952 * y + .953127 * z;
			const rD = viewingConditions.rgbD[0] * rC;
			const gD = viewingConditions.rgbD[1] * gC;
			const bD = viewingConditions.rgbD[2] * bC;
			const rAF = Math.pow(viewingConditions.fl * Math.abs(rD) / 100, .42);
			const gAF = Math.pow(viewingConditions.fl * Math.abs(gD) / 100, .42);
			const bAF = Math.pow(viewingConditions.fl * Math.abs(bD) / 100, .42);
			const rA = signum(rD) * 400 * rAF / (rAF + 27.13);
			const gA = signum(gD) * 400 * gAF / (gAF + 27.13);
			const bA = signum(bD) * 400 * bAF / (bAF + 27.13);
			const a = (11 * rA + -12 * gA + bA) / 11;
			const b = (rA + gA - 2 * bA) / 9;
			const u = (20 * rA + 20 * gA + 21 * bA) / 20;
			const p2 = (40 * rA + 20 * gA + bA) / 20;
			const atanDegrees = Math.atan2(b, a) * 180 / Math.PI;
			const hue = atanDegrees < 0 ? atanDegrees + 360 : atanDegrees >= 360 ? atanDegrees - 360 : atanDegrees;
			const hueRadians = hue * Math.PI / 180;
			const ac = p2 * viewingConditions.nbb;
			const J = 100 * Math.pow(ac / viewingConditions.aw, viewingConditions.c * viewingConditions.z);
			const Q = 4 / viewingConditions.c * Math.sqrt(J / 100) * (viewingConditions.aw + 4) * viewingConditions.fLRoot;
			const huePrime = hue < 20.14 ? hue + 360 : hue;
			const t = 5e4 / 13 * (1 / 4 * (Math.cos(huePrime * Math.PI / 180 + 2) + 3.8)) * viewingConditions.nc * viewingConditions.ncb * Math.sqrt(a * a + b * b) / (u + .305);
			const alpha = Math.pow(t, .9) * Math.pow(1.64 - Math.pow(.29, viewingConditions.n), .73);
			const C = alpha * Math.sqrt(J / 100);
			const M = C * viewingConditions.fLRoot;
			const s = 50 * Math.sqrt(alpha * viewingConditions.c / (viewingConditions.aw + 4));
			const jstar = (1 + 100 * .007) * J / (1 + .007 * J);
			const mstar = Math.log(1 + .0228 * M) / .0228;
			const astar = mstar * Math.cos(hueRadians);
			const bstar = mstar * Math.sin(hueRadians);
			return new Cam16(hue, C, J, Q, M, s, jstar, astar, bstar);
		}
		xyzInViewingConditions(viewingConditions) {
			const alpha = this.chroma === 0 || this.j === 0 ? 0 : this.chroma / Math.sqrt(this.j / 100);
			const t = Math.pow(alpha / Math.pow(1.64 - Math.pow(.29, viewingConditions.n), .73), 1 / .9);
			const hRad = this.hue * Math.PI / 180;
			const eHue = .25 * (Math.cos(hRad + 2) + 3.8);
			const ac = viewingConditions.aw * Math.pow(this.j / 100, 1 / viewingConditions.c / viewingConditions.z);
			const p1 = eHue * (5e4 / 13) * viewingConditions.nc * viewingConditions.ncb;
			const p2 = ac / viewingConditions.nbb;
			const hSin = Math.sin(hRad);
			const hCos = Math.cos(hRad);
			const gamma = 23 * (p2 + .305) * t / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
			const a = gamma * hCos;
			const b = gamma * hSin;
			const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
			const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
			const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
			const rCBase = Math.max(0, 27.13 * Math.abs(rA) / (400 - Math.abs(rA)));
			const rC = signum(rA) * (100 / viewingConditions.fl) * Math.pow(rCBase, 1 / .42);
			const gCBase = Math.max(0, 27.13 * Math.abs(gA) / (400 - Math.abs(gA)));
			const gC = signum(gA) * (100 / viewingConditions.fl) * Math.pow(gCBase, 1 / .42);
			const bCBase = Math.max(0, 27.13 * Math.abs(bA) / (400 - Math.abs(bA)));
			const bC = signum(bA) * (100 / viewingConditions.fl) * Math.pow(bCBase, 1 / .42);
			const rF = rC / viewingConditions.rgbD[0];
			const gF = gC / viewingConditions.rgbD[1];
			const bF = bC / viewingConditions.rgbD[2];
			return [
				1.86206786 * rF - 1.01125463 * gF + .14918677 * bF,
				.38752654 * rF + .62144744 * gF - .00897398 * bF,
				-.0158415 * rF - .03412294 * gF + 1.04996444 * bF
			];
		}
	};
	var HctSolver = class HctSolver {
		static sanitizeRadians(angle) {
			return (angle + Math.PI * 8) % (Math.PI * 2);
		}
		static trueDelinearized(rgbComponent) {
			const normalized = rgbComponent / 100;
			let delinearized = 0;
			if (normalized <= .0031308) delinearized = normalized * 12.92;
			else delinearized = 1.055 * Math.pow(normalized, 1 / 2.4) - .055;
			return delinearized * 255;
		}
		static chromaticAdaptation(component) {
			const af = Math.pow(Math.abs(component), .42);
			return signum(component) * 400 * af / (af + 27.13);
		}
		static hueOf(linrgb) {
			const scaledDiscount = matrixMultiply(linrgb, HctSolver.SCALED_DISCOUNT_FROM_LINRGB);
			const rA = HctSolver.chromaticAdaptation(scaledDiscount[0]);
			const gA = HctSolver.chromaticAdaptation(scaledDiscount[1]);
			const bA = HctSolver.chromaticAdaptation(scaledDiscount[2]);
			const a = (11 * rA + -12 * gA + bA) / 11;
			const b = (rA + gA - 2 * bA) / 9;
			return Math.atan2(b, a);
		}
		static areInCyclicOrder(a, b, c) {
			return HctSolver.sanitizeRadians(b - a) < HctSolver.sanitizeRadians(c - a);
		}
		static intercept(source, mid, target) {
			return (mid - source) / (target - source);
		}
		static lerpPoint(source, t, target) {
			return [
				source[0] + (target[0] - source[0]) * t,
				source[1] + (target[1] - source[1]) * t,
				source[2] + (target[2] - source[2]) * t
			];
		}
		static setCoordinate(source, coordinate, target, axis) {
			const t = HctSolver.intercept(source[axis], coordinate, target[axis]);
			return HctSolver.lerpPoint(source, t, target);
		}
		static isBounded(x) {
			return 0 <= x && x <= 100;
		}
		static nthVertex(y, n) {
			const kR = HctSolver.Y_FROM_LINRGB[0];
			const kG = HctSolver.Y_FROM_LINRGB[1];
			const kB = HctSolver.Y_FROM_LINRGB[2];
			const coordA = n % 4 <= 1 ? 0 : 100;
			const coordB = n % 2 === 0 ? 0 : 100;
			if (n < 4) {
				const g = coordA;
				const b = coordB;
				const r = (y - g * kG - b * kB) / kR;
				if (HctSolver.isBounded(r)) return [
					r,
					g,
					b
				];
				else return [
					-1,
					-1,
					-1
				];
			} else if (n < 8) {
				const b = coordA;
				const r = coordB;
				const g = (y - r * kR - b * kB) / kG;
				if (HctSolver.isBounded(g)) return [
					r,
					g,
					b
				];
				else return [
					-1,
					-1,
					-1
				];
			} else {
				const r = coordA;
				const g = coordB;
				const b = (y - r * kR - g * kG) / kB;
				if (HctSolver.isBounded(b)) return [
					r,
					g,
					b
				];
				else return [
					-1,
					-1,
					-1
				];
			}
		}
		static bisectToSegment(y, targetHue) {
			let left = [
				-1,
				-1,
				-1
			];
			let right = left;
			let leftHue = 0;
			let rightHue = 0;
			let initialized = false;
			let uncut = true;
			for (let n = 0; n < 12; n++) {
				const mid = HctSolver.nthVertex(y, n);
				if (mid[0] < 0) continue;
				const midHue = HctSolver.hueOf(mid);
				if (!initialized) {
					left = mid;
					right = mid;
					leftHue = midHue;
					rightHue = midHue;
					initialized = true;
					continue;
				}
				if (uncut || HctSolver.areInCyclicOrder(leftHue, midHue, rightHue)) {
					uncut = false;
					if (HctSolver.areInCyclicOrder(leftHue, targetHue, midHue)) {
						right = mid;
						rightHue = midHue;
					} else {
						left = mid;
						leftHue = midHue;
					}
				}
			}
			return [left, right];
		}
		static midpoint(a, b) {
			return [
				(a[0] + b[0]) / 2,
				(a[1] + b[1]) / 2,
				(a[2] + b[2]) / 2
			];
		}
		static criticalPlaneBelow(x) {
			return Math.floor(x - .5);
		}
		static criticalPlaneAbove(x) {
			return Math.ceil(x - .5);
		}
		static bisectToLimit(y, targetHue) {
			const segment = HctSolver.bisectToSegment(y, targetHue);
			let left = segment[0];
			let leftHue = HctSolver.hueOf(left);
			let right = segment[1];
			for (let axis = 0; axis < 3; axis++) if (left[axis] !== right[axis]) {
				let lPlane = -1;
				let rPlane = 255;
				if (left[axis] < right[axis]) {
					lPlane = HctSolver.criticalPlaneBelow(HctSolver.trueDelinearized(left[axis]));
					rPlane = HctSolver.criticalPlaneAbove(HctSolver.trueDelinearized(right[axis]));
				} else {
					lPlane = HctSolver.criticalPlaneAbove(HctSolver.trueDelinearized(left[axis]));
					rPlane = HctSolver.criticalPlaneBelow(HctSolver.trueDelinearized(right[axis]));
				}
				for (let i = 0; i < 8; i++) if (Math.abs(rPlane - lPlane) <= 1) break;
				else {
					const mPlane = Math.floor((lPlane + rPlane) / 2);
					const midPlaneCoordinate = HctSolver.CRITICAL_PLANES[mPlane];
					const mid = HctSolver.setCoordinate(left, midPlaneCoordinate, right, axis);
					const midHue = HctSolver.hueOf(mid);
					if (HctSolver.areInCyclicOrder(leftHue, targetHue, midHue)) {
						right = mid;
						rPlane = mPlane;
					} else {
						left = mid;
						leftHue = midHue;
						lPlane = mPlane;
					}
				}
			}
			return HctSolver.midpoint(left, right);
		}
		static inverseChromaticAdaptation(adapted) {
			const adaptedAbs = Math.abs(adapted);
			const base = Math.max(0, 27.13 * adaptedAbs / (400 - adaptedAbs));
			return signum(adapted) * Math.pow(base, 1 / .42);
		}
		static findResultByJ(hueRadians, chroma, y) {
			let j = Math.sqrt(y) * 11;
			const viewingConditions = ViewingConditions.DEFAULT;
			const tInnerCoeff = 1 / Math.pow(1.64 - Math.pow(.29, viewingConditions.n), .73);
			const p1 = .25 * (Math.cos(hueRadians + 2) + 3.8) * (5e4 / 13) * viewingConditions.nc * viewingConditions.ncb;
			const hSin = Math.sin(hueRadians);
			const hCos = Math.cos(hueRadians);
			for (let iterationRound = 0; iterationRound < 5; iterationRound++) {
				const jNormalized = j / 100;
				const alpha = chroma === 0 || j === 0 ? 0 : chroma / Math.sqrt(jNormalized);
				const t = Math.pow(alpha * tInnerCoeff, 1 / .9);
				const p2 = viewingConditions.aw * Math.pow(jNormalized, 1 / viewingConditions.c / viewingConditions.z) / viewingConditions.nbb;
				const gamma = 23 * (p2 + .305) * t / (23 * p1 + 11 * t * hCos + 108 * t * hSin);
				const a = gamma * hCos;
				const b = gamma * hSin;
				const rA = (460 * p2 + 451 * a + 288 * b) / 1403;
				const gA = (460 * p2 - 891 * a - 261 * b) / 1403;
				const bA = (460 * p2 - 220 * a - 6300 * b) / 1403;
				const linrgb = matrixMultiply([
					HctSolver.inverseChromaticAdaptation(rA),
					HctSolver.inverseChromaticAdaptation(gA),
					HctSolver.inverseChromaticAdaptation(bA)
				], HctSolver.LINRGB_FROM_SCALED_DISCOUNT);
				if (linrgb[0] < 0 || linrgb[1] < 0 || linrgb[2] < 0) return 0;
				const kR = HctSolver.Y_FROM_LINRGB[0];
				const kG = HctSolver.Y_FROM_LINRGB[1];
				const kB = HctSolver.Y_FROM_LINRGB[2];
				const fnj = kR * linrgb[0] + kG * linrgb[1] + kB * linrgb[2];
				if (fnj <= 0) return 0;
				if (iterationRound === 4 || Math.abs(fnj - y) < .002) {
					if (linrgb[0] > 100.01 || linrgb[1] > 100.01 || linrgb[2] > 100.01) return 0;
					return argbFromLinrgb(linrgb);
				}
				j = j - (fnj - y) * j / (2 * fnj);
			}
			return 0;
		}
		static solveToInt(hueDegrees, chroma, lstar) {
			if (chroma < 1e-4 || lstar < 1e-4 || lstar > 99.9999) return argbFromLstar(lstar);
			hueDegrees = sanitizeDegreesDouble(hueDegrees);
			const hueRadians = hueDegrees / 180 * Math.PI;
			const y = yFromLstar(lstar);
			const exactAnswer = HctSolver.findResultByJ(hueRadians, chroma, y);
			if (exactAnswer !== 0) return exactAnswer;
			return argbFromLinrgb(HctSolver.bisectToLimit(y, hueRadians));
		}
		static solveToCam(hueDegrees, chroma, lstar) {
			return Cam16.fromInt(HctSolver.solveToInt(hueDegrees, chroma, lstar));
		}
	};
	HctSolver.SCALED_DISCOUNT_FROM_LINRGB = [
		[
			.001200833568784504,
			.002389694492170889,
			.0002795742885861124
		],
		[
			.0005891086651375999,
			.0029785502573438758,
			.0003270666104008398
		],
		[
			.00010146692491640572,
			.0005364214359186694,
			.0032979401770712076
		]
	];
	HctSolver.LINRGB_FROM_SCALED_DISCOUNT = [
		[
			1373.2198709594231,
			-1100.4251190754821,
			-7.278681089101213
		],
		[
			-271.815969077903,
			559.6580465940733,
			-32.46047482791194
		],
		[
			1.9622899599665666,
			-57.173814538844006,
			308.7233197812385
		]
	];
	HctSolver.Y_FROM_LINRGB = [
		.2126,
		.7152,
		.0722
	];
	HctSolver.CRITICAL_PLANES = [
		.015176349177441876,
		.045529047532325624,
		.07588174588720938,
		.10623444424209313,
		.13658714259697685,
		.16693984095186062,
		.19729253930674434,
		.2276452376616281,
		.2579979360165119,
		.28835063437139563,
		.3188300904430532,
		.350925934958123,
		.3848314933096426,
		.42057480301049466,
		.458183274052838,
		.4976837250274023,
		.5391024159806381,
		.5824650784040898,
		.6277969426914107,
		.6751227633498623,
		.7244668422128921,
		.775853049866786,
		.829304845476233,
		.8848452951698498,
		.942497089126609,
		1.0022825574869039,
		1.0642236851973577,
		1.1283421258858297,
		1.1946592148522128,
		1.2631959812511864,
		1.3339731595349034,
		1.407011200216447,
		1.4823302800086415,
		1.5599503113873272,
		1.6398909516233677,
		1.7221716113234105,
		1.8068114625156377,
		1.8938294463134073,
		1.9832442801866852,
		2.075074464868551,
		2.1693382909216234,
		2.2660538449872063,
		2.36523901573795,
		2.4669114995532007,
		2.5710888059345764,
		2.6777882626779785,
		2.7870270208169257,
		2.898822059350997,
		3.0131901897720907,
		3.1301480604002863,
		3.2497121605402226,
		3.3718988244681087,
		3.4967242352587946,
		3.624204428461639,
		3.754355295633311,
		3.887192587735158,
		4.022731918402185,
		4.160988767090289,
		4.301978482107941,
		4.445716283538092,
		4.592217266055746,
		4.741496401646282,
		4.893568542229298,
		5.048448422192488,
		5.20615066083972,
		5.3666897647573375,
		5.5300801301023865,
		5.696336044816294,
		5.865471690767354,
		6.037501145825082,
		6.212438385869475,
		6.390297286737924,
		6.571091626112461,
		6.7548350853498045,
		6.941541251256611,
		7.131223617812143,
		7.323895587840543,
		7.5195704746346665,
		7.7182615035334345,
		7.919981813454504,
		8.124744458384042,
		8.332562408825165,
		8.543448553206703,
		8.757415699253682,
		8.974476575321063,
		9.194643831691977,
		9.417930041841839,
		9.644347703669503,
		9.873909240696694,
		10.106627003236781,
		10.342513269534024,
		10.58158024687427,
		10.8238400726681,
		11.069304815507364,
		11.317986476196008,
		11.569896988756009,
		11.825048221409341,
		12.083451977536606,
		12.345119996613247,
		12.610063955123938,
		12.878295467455942,
		13.149826086772048,
		13.42466730586372,
		13.702830557985108,
		13.984327217668513,
		14.269168601521828,
		14.55736596900856,
		14.848930523210871,
		15.143873411576273,
		15.44220572664832,
		15.743938506781891,
		16.04908273684337,
		16.35764934889634,
		16.66964922287304,
		16.985093187232053,
		17.30399201960269,
		17.62635644741625,
		17.95219714852476,
		18.281524751807332,
		18.614349837764564,
		18.95068293910138,
		19.290534541298456,
		19.633915083172692,
		19.98083495742689,
		20.331304511189067,
		20.685334046541502,
		21.042933821039977,
		21.404114048223256,
		21.76888489811322,
		22.137256497705877,
		22.50923893145328,
		22.884842241736916,
		23.264076429332462,
		23.6469514538663,
		24.033477234264016,
		24.42366364919083,
		24.817520537484558,
		25.21505769858089,
		25.61628489293138,
		26.021211842414342,
		26.429848230738664,
		26.842203703840827,
		27.258287870275353,
		27.678110301598522,
		28.10168053274597,
		28.529008062403893,
		28.96010235337422,
		29.39497283293396,
		29.83362889318845,
		30.276079891419332,
		30.722335150426627,
		31.172403958865512,
		31.62629557157785,
		32.08401920991837,
		32.54558406207592,
		33.010999283389665,
		33.4802739966603,
		33.953417292456834,
		34.430438229418264,
		34.911345834551085,
		35.39614910352207,
		35.88485700094671,
		36.37747846067349,
		36.87402238606382,
		37.37449765026789,
		37.87891309649659,
		38.38727753828926,
		38.89959975977785,
		39.41588851594697,
		39.93615253289054,
		40.460400508064545,
		40.98864111053629,
		41.520882981230194,
		42.05713473317016,
		42.597404951718396,
		43.141702194811224,
		43.6900349931913,
		44.24241185063697,
		44.798841244188324,
		45.35933162437017,
		45.92389141541209,
		46.49252901546552,
		47.065252796817916,
		47.64207110610409,
		48.22299226451468,
		48.808024568002054,
		49.3971762874833,
		49.9904556690408,
		50.587870934119984,
		51.189430279724725,
		51.79514187861014,
		52.40501387947288,
		53.0190544071392,
		53.637271562750364,
		54.259673423945976,
		54.88626804504493,
		55.517063457223934,
		56.15206766869424,
		56.79128866487574,
		57.43473440856916,
		58.08241284012621,
		58.734331877617365,
		59.39049941699807,
		60.05092333227251,
		60.715611475655585,
		61.38457167773311,
		62.057811747619894,
		62.7353394731159,
		63.417162620860914,
		64.10328893648692,
		64.79372614476921,
		65.48848194977529,
		66.18756403501224,
		66.89098006357258,
		67.59873767827808,
		68.31084450182222,
		69.02730813691093,
		69.74813616640164,
		70.47333615344107,
		71.20291564160104,
		71.93688215501312,
		72.67524319850172,
		73.41800625771542,
		74.16517879925733,
		74.9167682708136,
		75.67278210128072,
		76.43322770089146,
		77.1981124613393,
		77.96744375590167,
		78.74122893956174,
		79.51947534912904,
		80.30219030335869,
		81.08938110306934,
		81.88105503125999,
		82.67721935322541,
		83.4778813166706,
		84.28304815182372,
		85.09272707154808,
		85.90692527145302,
		86.72564993000343,
		87.54890820862819,
		88.3767072518277,
		89.2090541872801,
		90.04595612594655,
		90.88742016217518,
		91.73345337380438,
		92.58406282226491,
		93.43925555268066,
		94.29903859396902,
		95.16341895893969,
		96.03240364439274,
		96.9059996312159,
		97.78421388448044,
		98.6670533535366,
		99.55452497210776
	];
	var Hct = class Hct {
		static from(hue, chroma, tone) {
			return new Hct(HctSolver.solveToInt(hue, chroma, tone));
		}
		static fromInt(argb) {
			return new Hct(argb);
		}
		toInt() {
			return this.argb;
		}
		get hue() {
			return this.internalHue;
		}
		set hue(newHue) {
			this.setInternalState(HctSolver.solveToInt(newHue, this.internalChroma, this.internalTone));
		}
		get chroma() {
			return this.internalChroma;
		}
		set chroma(newChroma) {
			this.setInternalState(HctSolver.solveToInt(this.internalHue, newChroma, this.internalTone));
		}
		get tone() {
			return this.internalTone;
		}
		set tone(newTone) {
			this.setInternalState(HctSolver.solveToInt(this.internalHue, this.internalChroma, newTone));
		}
		setValue(propertyName, value) {
			this[propertyName] = value;
		}
		toString() {
			return `HCT(${this.hue.toFixed(0)}, ${this.chroma.toFixed(0)}, ${this.tone.toFixed(0)})`;
		}
		static isBlue(hue) {
			return hue >= 250 && hue < 270;
		}
		static isYellow(hue) {
			return hue >= 105 && hue < 125;
		}
		static isCyan(hue) {
			return hue >= 170 && hue < 207;
		}
		constructor(argb) {
			this.argb = argb;
			const cam = Cam16.fromInt(argb);
			this.internalHue = cam.hue;
			this.internalChroma = cam.chroma;
			this.internalTone = lstarFromArgb(argb);
			this.argb = argb;
		}
		setInternalState(argb) {
			const cam = Cam16.fromInt(argb);
			this.internalHue = cam.hue;
			this.internalChroma = cam.chroma;
			this.internalTone = lstarFromArgb(argb);
			this.argb = argb;
		}
		inViewingConditions(vc) {
			const viewedInVc = Cam16.fromInt(this.toInt()).xyzInViewingConditions(vc);
			const recastInVc = Cam16.fromXyzInViewingConditions(viewedInVc[0], viewedInVc[1], viewedInVc[2], ViewingConditions.make());
			return Hct.from(recastInVc.hue, recastInVc.chroma, lstarFromY(viewedInVc[1]));
		}
	};
	var Blend = class Blend {
		static harmonize(designColor, sourceColor) {
			const fromHct = Hct.fromInt(designColor);
			const toHct = Hct.fromInt(sourceColor);
			const differenceDegrees$2 = differenceDegrees(fromHct.hue, toHct.hue);
			const rotationDegrees = Math.min(differenceDegrees$2 * .5, 15);
			const outputHue = sanitizeDegreesDouble(fromHct.hue + rotationDegrees * rotationDirection(fromHct.hue, toHct.hue));
			return Hct.from(outputHue, fromHct.chroma, fromHct.tone).toInt();
		}
		static hctHue(from, to, amount) {
			const ucs = Blend.cam16Ucs(from, to, amount);
			const ucsCam = Cam16.fromInt(ucs);
			const fromCam = Cam16.fromInt(from);
			return Hct.from(ucsCam.hue, fromCam.chroma, lstarFromArgb(from)).toInt();
		}
		static cam16Ucs(from, to, amount) {
			const fromCam = Cam16.fromInt(from);
			const toCam = Cam16.fromInt(to);
			const fromJ = fromCam.jstar;
			const fromA = fromCam.astar;
			const fromB = fromCam.bstar;
			const toJ = toCam.jstar;
			const toA = toCam.astar;
			const toB = toCam.bstar;
			const jstar = fromJ + (toJ - fromJ) * amount;
			const astar = fromA + (toA - fromA) * amount;
			const bstar = fromB + (toB - fromB) * amount;
			return Cam16.fromUcs(jstar, astar, bstar).toInt();
		}
	};
	var Contrast = class Contrast {
		static ratioOfTones(toneA, toneB) {
			toneA = clampDouble(0, 100, toneA);
			toneB = clampDouble(0, 100, toneB);
			return Contrast.ratioOfYs(yFromLstar(toneA), yFromLstar(toneB));
		}
		static ratioOfYs(y1, y2) {
			const lighter = y1 > y2 ? y1 : y2;
			const darker = lighter === y2 ? y1 : y2;
			return (lighter + 5) / (darker + 5);
		}
		static lighter(tone, ratio) {
			if (tone < 0 || tone > 100) return -1;
			const darkY = yFromLstar(tone);
			const lightY = ratio * (darkY + 5) - 5;
			const realContrast = Contrast.ratioOfYs(lightY, darkY);
			const delta = Math.abs(realContrast - ratio);
			if (realContrast < ratio && delta > .04) return -1;
			const returnValue = lstarFromY(lightY) + .4;
			if (returnValue < 0 || returnValue > 100) return -1;
			return returnValue;
		}
		static darker(tone, ratio) {
			if (tone < 0 || tone > 100) return -1;
			const lightY = yFromLstar(tone);
			const darkY = (lightY + 5) / ratio - 5;
			const realContrast = Contrast.ratioOfYs(lightY, darkY);
			const delta = Math.abs(realContrast - ratio);
			if (realContrast < ratio && delta > .04) return -1;
			const returnValue = lstarFromY(darkY) - .4;
			if (returnValue < 0 || returnValue > 100) return -1;
			return returnValue;
		}
		static lighterUnsafe(tone, ratio) {
			const lighterSafe = Contrast.lighter(tone, ratio);
			return lighterSafe < 0 ? 100 : lighterSafe;
		}
		static darkerUnsafe(tone, ratio) {
			const darkerSafe = Contrast.darker(tone, ratio);
			return darkerSafe < 0 ? 0 : darkerSafe;
		}
	};
	var DislikeAnalyzer = class DislikeAnalyzer {
		static isDisliked(hct) {
			const huePasses = Math.round(hct.hue) >= 90 && Math.round(hct.hue) <= 111;
			const chromaPasses = Math.round(hct.chroma) > 16;
			const tonePasses = Math.round(hct.tone) < 65;
			return huePasses && chromaPasses && tonePasses;
		}
		static fixIfDisliked(hct) {
			if (DislikeAnalyzer.isDisliked(hct)) return Hct.from(hct.hue, hct.chroma, 70);
			return hct;
		}
	};
	function validateExtendedColor(originalColor, specVersion, extendedColor) {
		if (originalColor.name !== extendedColor.name) throw new Error(`Attempting to extend color ${originalColor.name} with color ${extendedColor.name} of different name for spec version ${specVersion}.`);
		if (originalColor.isBackground !== extendedColor.isBackground) throw new Error(`Attempting to extend color ${originalColor.name} as a ${originalColor.isBackground ? "background" : "foreground"} with color ${extendedColor.name} as a ${extendedColor.isBackground ? "background" : "foreground"} for spec version ${specVersion}.`);
	}
	function extendSpecVersion(originlColor, specVersion, extendedColor) {
		validateExtendedColor(originlColor, specVersion, extendedColor);
		return DynamicColor.fromPalette({
			name: originlColor.name,
			palette: (s) => s.specVersion === specVersion ? extendedColor.palette(s) : originlColor.palette(s),
			tone: (s) => s.specVersion === specVersion ? extendedColor.tone(s) : originlColor.tone(s),
			isBackground: originlColor.isBackground,
			chromaMultiplier: (s) => {
				const chromaMultiplier = s.specVersion === specVersion ? extendedColor.chromaMultiplier : originlColor.chromaMultiplier;
				return chromaMultiplier !== void 0 ? chromaMultiplier(s) : 1;
			},
			background: (s) => {
				const background = s.specVersion === specVersion ? extendedColor.background : originlColor.background;
				return background !== void 0 ? background(s) : void 0;
			},
			secondBackground: (s) => {
				const secondBackground = s.specVersion === specVersion ? extendedColor.secondBackground : originlColor.secondBackground;
				return secondBackground !== void 0 ? secondBackground(s) : void 0;
			},
			contrastCurve: (s) => {
				const contrastCurve = s.specVersion === specVersion ? extendedColor.contrastCurve : originlColor.contrastCurve;
				return contrastCurve !== void 0 ? contrastCurve(s) : void 0;
			},
			toneDeltaPair: (s) => {
				const toneDeltaPair = s.specVersion === specVersion ? extendedColor.toneDeltaPair : originlColor.toneDeltaPair;
				return toneDeltaPair !== void 0 ? toneDeltaPair(s) : void 0;
			}
		});
	}
	var DynamicColor = class DynamicColor {
		static fromPalette(args) {
			return new DynamicColor(args.name ?? "", args.palette, args.tone ?? DynamicColor.getInitialToneFromBackground(args.background), args.isBackground ?? false, args.chromaMultiplier, args.background, args.secondBackground, args.contrastCurve, args.toneDeltaPair);
		}
		static getInitialToneFromBackground(background) {
			if (background === void 0) return (s) => 50;
			return (s) => background(s) ? background(s).getTone(s) : 50;
		}
		constructor(name, palette, tone, isBackground, chromaMultiplier, background, secondBackground, contrastCurve, toneDeltaPair) {
			this.name = name;
			this.palette = palette;
			this.tone = tone;
			this.isBackground = isBackground;
			this.chromaMultiplier = chromaMultiplier;
			this.background = background;
			this.secondBackground = secondBackground;
			this.contrastCurve = contrastCurve;
			this.toneDeltaPair = toneDeltaPair;
			this.hctCache = new Map();
			if (!background && secondBackground) throw new Error(`Color ${name} has secondBackgrounddefined, but background is not defined.`);
			if (!background && contrastCurve) throw new Error(`Color ${name} has contrastCurvedefined, but background is not defined.`);
			if (background && !contrastCurve) throw new Error(`Color ${name} has backgrounddefined, but contrastCurve is not defined.`);
		}
		clone() {
			return DynamicColor.fromPalette({
				name: this.name,
				palette: this.palette,
				tone: this.tone,
				isBackground: this.isBackground,
				chromaMultiplier: this.chromaMultiplier,
				background: this.background,
				secondBackground: this.secondBackground,
				contrastCurve: this.contrastCurve,
				toneDeltaPair: this.toneDeltaPair
			});
		}
		clearCache() {
			this.hctCache.clear();
		}
		getArgb(scheme) {
			return this.getHct(scheme).toInt();
		}
		getHct(scheme) {
			const cachedAnswer = this.hctCache.get(scheme);
			if (cachedAnswer != null) return cachedAnswer;
			const answer = getSpec$1(scheme.specVersion).getHct(scheme, this);
			if (this.hctCache.size > 4) this.hctCache.clear();
			this.hctCache.set(scheme, answer);
			return answer;
		}
		getTone(scheme) {
			return getSpec$1(scheme.specVersion).getTone(scheme, this);
		}
		static foregroundTone(bgTone, ratio) {
			const lighterTone = Contrast.lighterUnsafe(bgTone, ratio);
			const darkerTone = Contrast.darkerUnsafe(bgTone, ratio);
			const lighterRatio = Contrast.ratioOfTones(lighterTone, bgTone);
			const darkerRatio = Contrast.ratioOfTones(darkerTone, bgTone);
			if (DynamicColor.tonePrefersLightForeground(bgTone)) {
				const negligibleDifference = Math.abs(lighterRatio - darkerRatio) < .1 && lighterRatio < ratio && darkerRatio < ratio;
				return lighterRatio >= ratio || lighterRatio >= darkerRatio || negligibleDifference ? lighterTone : darkerTone;
			} else return darkerRatio >= ratio || darkerRatio >= lighterRatio ? darkerTone : lighterTone;
		}
		static tonePrefersLightForeground(tone) {
			return Math.round(tone) < 60;
		}
		static toneAllowsLightForeground(tone) {
			return Math.round(tone) <= 49;
		}
		static enableLightForeground(tone) {
			if (DynamicColor.tonePrefersLightForeground(tone) && !DynamicColor.toneAllowsLightForeground(tone)) return 49;
			return tone;
		}
	};
	var ColorCalculationDelegateImpl2021 = class {
		getHct(scheme, color) {
			const tone = color.getTone(scheme);
			return color.palette(scheme).getHct(tone);
		}
		getTone(scheme, color) {
			const decreasingContrast = scheme.contrastLevel < 0;
			const toneDeltaPair = color.toneDeltaPair ? color.toneDeltaPair(scheme) : void 0;
			if (toneDeltaPair) {
				const roleA = toneDeltaPair.roleA;
				const roleB = toneDeltaPair.roleB;
				const delta = toneDeltaPair.delta;
				const polarity = toneDeltaPair.polarity;
				const stayTogether = toneDeltaPair.stayTogether;
				const aIsNearer = polarity === "nearer" || polarity === "lighter" && !scheme.isDark || polarity === "darker" && scheme.isDark;
				const nearer = aIsNearer ? roleA : roleB;
				const farther = aIsNearer ? roleB : roleA;
				const amNearer = color.name === nearer.name;
				const expansionDir = scheme.isDark ? 1 : -1;
				let nTone = nearer.tone(scheme);
				let fTone = farther.tone(scheme);
				if (color.background && nearer.contrastCurve && farther.contrastCurve) {
					const bg = color.background(scheme);
					const nContrastCurve = nearer.contrastCurve(scheme);
					const fContrastCurve = farther.contrastCurve(scheme);
					if (bg && nContrastCurve && fContrastCurve) {
						const bgTone = bg.getTone(scheme);
						const nContrast = nContrastCurve.get(scheme.contrastLevel);
						const fContrast = fContrastCurve.get(scheme.contrastLevel);
						if (Contrast.ratioOfTones(bgTone, nTone) < nContrast) nTone = DynamicColor.foregroundTone(bgTone, nContrast);
						if (Contrast.ratioOfTones(bgTone, fTone) < fContrast) fTone = DynamicColor.foregroundTone(bgTone, fContrast);
						if (decreasingContrast) {
							nTone = DynamicColor.foregroundTone(bgTone, nContrast);
							fTone = DynamicColor.foregroundTone(bgTone, fContrast);
						}
					}
				}
				if ((fTone - nTone) * expansionDir < delta) {
					fTone = clampDouble(0, 100, nTone + delta * expansionDir);
					if ((fTone - nTone) * expansionDir >= delta) {} else nTone = clampDouble(0, 100, fTone - delta * expansionDir);
				}
				if (50 <= nTone && nTone < 60) {
					if (expansionDir > 0) {
						nTone = 60;
						fTone = Math.max(fTone, nTone + delta * expansionDir);
					} else {
						nTone = 49;
						fTone = Math.min(fTone, nTone + delta * expansionDir);
					}
				} else if (50 <= fTone && fTone < 60) {
					if (stayTogether) {
						if (expansionDir > 0) {
							nTone = 60;
							fTone = Math.max(fTone, nTone + delta * expansionDir);
						} else {
							nTone = 49;
							fTone = Math.min(fTone, nTone + delta * expansionDir);
						}
					} else if (expansionDir > 0) fTone = 60;
					else fTone = 49;
				}
				return amNearer ? nTone : fTone;
			} else {
				let answer = color.tone(scheme);
				if (color.background == void 0 || color.background(scheme) === void 0 || color.contrastCurve == void 0 || color.contrastCurve(scheme) === void 0) return answer;
				const bgTone = color.background(scheme).getTone(scheme);
				const desiredRatio = color.contrastCurve(scheme).get(scheme.contrastLevel);
				if (Contrast.ratioOfTones(bgTone, answer) >= desiredRatio) {} else answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
				if (decreasingContrast) answer = DynamicColor.foregroundTone(bgTone, desiredRatio);
				if (color.isBackground && 50 <= answer && answer < 60) {
					if (Contrast.ratioOfTones(49, bgTone) >= desiredRatio) answer = 49;
					else answer = 60;
				}
				if (color.secondBackground == void 0 || color.secondBackground(scheme) === void 0) return answer;
				const [bg1, bg2] = [color.background, color.secondBackground];
				const [bgTone1, bgTone2] = [bg1(scheme).getTone(scheme), bg2(scheme).getTone(scheme)];
				const [upper, lower] = [Math.max(bgTone1, bgTone2), Math.min(bgTone1, bgTone2)];
				if (Contrast.ratioOfTones(upper, answer) >= desiredRatio && Contrast.ratioOfTones(lower, answer) >= desiredRatio) return answer;
				const lightOption = Contrast.lighter(upper, desiredRatio);
				const darkOption = Contrast.darker(lower, desiredRatio);
				const availables = [];
				if (lightOption !== -1) availables.push(lightOption);
				if (darkOption !== -1) availables.push(darkOption);
				if (DynamicColor.tonePrefersLightForeground(bgTone1) || DynamicColor.tonePrefersLightForeground(bgTone2)) return lightOption < 0 ? 100 : lightOption;
				if (availables.length === 1) return availables[0];
				return darkOption < 0 ? 0 : darkOption;
			}
		}
	};
	var ColorCalculationDelegateImpl2025 = class {
		getHct(scheme, color) {
			const palette = color.palette(scheme);
			const tone = color.getTone(scheme);
			const hue = palette.hue;
			const chroma = palette.chroma * (color.chromaMultiplier ? color.chromaMultiplier(scheme) : 1);
			return Hct.from(hue, chroma, tone);
		}
		getTone(scheme, color) {
			const toneDeltaPair = color.toneDeltaPair ? color.toneDeltaPair(scheme) : void 0;
			if (toneDeltaPair) {
				const roleA = toneDeltaPair.roleA;
				const roleB = toneDeltaPair.roleB;
				const polarity = toneDeltaPair.polarity;
				const constraint = toneDeltaPair.constraint;
				const absoluteDelta = polarity === "darker" || polarity === "relative_lighter" && scheme.isDark || polarity === "relative_darker" && !scheme.isDark ? -toneDeltaPair.delta : toneDeltaPair.delta;
				const amRoleA = color.name === roleA.name;
				const selfRole = amRoleA ? roleA : roleB;
				const refRole = amRoleA ? roleB : roleA;
				let selfTone = selfRole.tone(scheme);
				let refTone = refRole.getTone(scheme);
				const relativeDelta = absoluteDelta * (amRoleA ? 1 : -1);
				if (constraint === "exact") selfTone = clampDouble(0, 100, refTone + relativeDelta);
				else if (constraint === "nearer") {
					if (relativeDelta > 0) selfTone = clampDouble(0, 100, clampDouble(refTone, refTone + relativeDelta, selfTone));
					else selfTone = clampDouble(0, 100, clampDouble(refTone + relativeDelta, refTone, selfTone));
				} else if (constraint === "farther") {
					if (relativeDelta > 0) selfTone = clampDouble(refTone + relativeDelta, 100, selfTone);
					else selfTone = clampDouble(0, refTone + relativeDelta, selfTone);
				}
				if (color.background && color.contrastCurve) {
					const background = color.background(scheme);
					const contrastCurve = color.contrastCurve(scheme);
					if (background && contrastCurve) {
						const bgTone = background.getTone(scheme);
						const selfContrast = contrastCurve.get(scheme.contrastLevel);
						selfTone = Contrast.ratioOfTones(bgTone, selfTone) >= selfContrast && scheme.contrastLevel >= 0 ? selfTone : DynamicColor.foregroundTone(bgTone, selfContrast);
					}
				}
				if (color.isBackground && !color.name.endsWith("_fixed_dim")) {
					if (selfTone >= 57) selfTone = clampDouble(65, 100, selfTone);
					else selfTone = clampDouble(0, 49, selfTone);
				}
				return selfTone;
			} else {
				let answer = color.tone(scheme);
				if (color.background == void 0 || color.background(scheme) === void 0 || color.contrastCurve == void 0 || color.contrastCurve(scheme) === void 0) return answer;
				const bgTone = color.background(scheme).getTone(scheme);
				const desiredRatio = color.contrastCurve(scheme).get(scheme.contrastLevel);
				answer = Contrast.ratioOfTones(bgTone, answer) >= desiredRatio && scheme.contrastLevel >= 0 ? answer : DynamicColor.foregroundTone(bgTone, desiredRatio);
				if (color.isBackground && !color.name.endsWith("_fixed_dim")) {
					if (answer >= 57) answer = clampDouble(65, 100, answer);
					else answer = clampDouble(0, 49, answer);
				}
				if (color.secondBackground == void 0 || color.secondBackground(scheme) === void 0) return answer;
				const [bg1, bg2] = [color.background, color.secondBackground];
				const [bgTone1, bgTone2] = [bg1(scheme).getTone(scheme), bg2(scheme).getTone(scheme)];
				const [upper, lower] = [Math.max(bgTone1, bgTone2), Math.min(bgTone1, bgTone2)];
				if (Contrast.ratioOfTones(upper, answer) >= desiredRatio && Contrast.ratioOfTones(lower, answer) >= desiredRatio) return answer;
				const lightOption = Contrast.lighter(upper, desiredRatio);
				const darkOption = Contrast.darker(lower, desiredRatio);
				const availables = [];
				if (lightOption !== -1) availables.push(lightOption);
				if (darkOption !== -1) availables.push(darkOption);
				if (DynamicColor.tonePrefersLightForeground(bgTone1) || DynamicColor.tonePrefersLightForeground(bgTone2)) return lightOption < 0 ? 100 : lightOption;
				if (availables.length === 1) return availables[0];
				return darkOption < 0 ? 0 : darkOption;
			}
		}
	};
	var spec2021$1 = new ColorCalculationDelegateImpl2021();
	var spec2025$1 = new ColorCalculationDelegateImpl2025();
	function getSpec$1(specVersion) {
		return specVersion === "2025" ? spec2025$1 : spec2021$1;
	}
	var TonalPalette = class TonalPalette {
		static fromInt(argb) {
			const hct = Hct.fromInt(argb);
			return TonalPalette.fromHct(hct);
		}
		static fromHct(hct) {
			return new TonalPalette(hct.hue, hct.chroma, hct);
		}
		static fromHueAndChroma(hue, chroma) {
			const keyColor = new KeyColor(hue, chroma).create();
			return new TonalPalette(hue, chroma, keyColor);
		}
		constructor(hue, chroma, keyColor) {
			this.hue = hue;
			this.chroma = chroma;
			this.keyColor = keyColor;
			this.cache = new Map();
		}
		tone(tone) {
			let argb = this.cache.get(tone);
			if (argb === void 0) {
				if (tone == 99 && Hct.isYellow(this.hue)) argb = this.averageArgb(this.tone(98), this.tone(100));
				else argb = Hct.from(this.hue, this.chroma, tone).toInt();
				this.cache.set(tone, argb);
			}
			return argb;
		}
		getHct(tone) {
			return Hct.fromInt(this.tone(tone));
		}
		averageArgb(argb1, argb2) {
			const red1 = argb1 >>> 16 & 255;
			const green1 = argb1 >>> 8 & 255;
			const blue1 = argb1 & 255;
			const red2 = argb2 >>> 16 & 255;
			const green2 = argb2 >>> 8 & 255;
			const blue2 = argb2 & 255;
			const red = Math.round((red1 + red2) / 2);
			const green = Math.round((green1 + green2) / 2);
			const blue = Math.round((blue1 + blue2) / 2);
			return (255 << 24 | (red & 255) << 16 | (green & 255) << 8 | blue & 255) >>> 0;
		}
	};
	var KeyColor = class {
		constructor(hue, requestedChroma) {
			this.hue = hue;
			this.requestedChroma = requestedChroma;
			this.chromaCache = new Map();
			this.maxChromaValue = 200;
		}
		create() {
			const pivotTone = 50;
			const toneStepSize = 1;
			const epsilon = .01;
			let lowerTone = 0;
			let upperTone = 100;
			while (lowerTone < upperTone) {
				const midTone = Math.floor((lowerTone + upperTone) / 2);
				const isAscending = this.maxChroma(midTone) < this.maxChroma(midTone + toneStepSize);
				if (this.maxChroma(midTone) >= this.requestedChroma - epsilon) {
					if (Math.abs(lowerTone - pivotTone) < Math.abs(upperTone - pivotTone)) upperTone = midTone;
					else {
						if (lowerTone === midTone) return Hct.from(this.hue, this.requestedChroma, lowerTone);
						lowerTone = midTone;
					}
				} else if (isAscending) lowerTone = midTone + toneStepSize;
				else upperTone = midTone;
			}
			return Hct.from(this.hue, this.requestedChroma, lowerTone);
		}
		maxChroma(tone) {
			if (this.chromaCache.has(tone)) return this.chromaCache.get(tone);
			const chroma = Hct.from(this.hue, this.maxChromaValue, tone).chroma;
			this.chromaCache.set(tone, chroma);
			return chroma;
		}
	};
	var TemperatureCache = class TemperatureCache {
		constructor(input) {
			this.input = input;
			this.hctsByTempCache = [];
			this.hctsByHueCache = [];
			this.tempsByHctCache = new Map();
			this.inputRelativeTemperatureCache = -1;
			this.complementCache = null;
		}
		get hctsByTemp() {
			if (this.hctsByTempCache.length > 0) return this.hctsByTempCache;
			const hcts = this.hctsByHue.concat([this.input]);
			const temperaturesByHct = this.tempsByHct;
			hcts.sort((a, b) => temperaturesByHct.get(a) - temperaturesByHct.get(b));
			this.hctsByTempCache = hcts;
			return hcts;
		}
		get warmest() {
			return this.hctsByTemp[this.hctsByTemp.length - 1];
		}
		get coldest() {
			return this.hctsByTemp[0];
		}
		analogous(count = 5, divisions = 12) {
			const startHue = Math.round(this.input.hue);
			const startHct = this.hctsByHue[startHue];
			let lastTemp = this.relativeTemperature(startHct);
			const allColors = [startHct];
			let absoluteTotalTempDelta = 0;
			for (let i = 0; i < 360; i++) {
				const hue = sanitizeDegreesInt(startHue + i);
				const hct = this.hctsByHue[hue];
				const temp = this.relativeTemperature(hct);
				const tempDelta = Math.abs(temp - lastTemp);
				lastTemp = temp;
				absoluteTotalTempDelta += tempDelta;
			}
			let hueAddend = 1;
			const tempStep = absoluteTotalTempDelta / divisions;
			let totalTempDelta = 0;
			lastTemp = this.relativeTemperature(startHct);
			while (allColors.length < divisions) {
				const hue = sanitizeDegreesInt(startHue + hueAddend);
				const hct = this.hctsByHue[hue];
				const temp = this.relativeTemperature(hct);
				const tempDelta = Math.abs(temp - lastTemp);
				totalTempDelta += tempDelta;
				const desiredTotalTempDeltaForIndex = allColors.length * tempStep;
				let indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
				let indexAddend = 1;
				while (indexSatisfied && allColors.length < divisions) {
					allColors.push(hct);
					const desiredTotalTempDeltaForIndex = (allColors.length + indexAddend) * tempStep;
					indexSatisfied = totalTempDelta >= desiredTotalTempDeltaForIndex;
					indexAddend++;
				}
				lastTemp = temp;
				hueAddend++;
				if (hueAddend > 360) {
					while (allColors.length < divisions) allColors.push(hct);
					break;
				}
			}
			const answers = [this.input];
			const increaseHueCount = Math.floor((count - 1) / 2);
			for (let i = 1; i < increaseHueCount + 1; i++) {
				let index = 0 - i;
				while (index < 0) index = allColors.length + index;
				if (index >= allColors.length) index = index % allColors.length;
				answers.splice(0, 0, allColors[index]);
			}
			const decreaseHueCount = count - increaseHueCount - 1;
			for (let i = 1; i < decreaseHueCount + 1; i++) {
				let index = i;
				while (index < 0) index = allColors.length + index;
				if (index >= allColors.length) index = index % allColors.length;
				answers.push(allColors[index]);
			}
			return answers;
		}
		get complement() {
			if (this.complementCache != null) return this.complementCache;
			const coldestHue = this.coldest.hue;
			const coldestTemp = this.tempsByHct.get(this.coldest);
			const warmestHue = this.warmest.hue;
			const range = this.tempsByHct.get(this.warmest) - coldestTemp;
			const startHueIsColdestToWarmest = TemperatureCache.isBetween(this.input.hue, coldestHue, warmestHue);
			const startHue = startHueIsColdestToWarmest ? warmestHue : coldestHue;
			const endHue = startHueIsColdestToWarmest ? coldestHue : warmestHue;
			const directionOfRotation = 1;
			let smallestError = 1e3;
			let answer = this.hctsByHue[Math.round(this.input.hue)];
			const complementRelativeTemp = 1 - this.inputRelativeTemperature;
			for (let hueAddend = 0; hueAddend <= 360; hueAddend += 1) {
				const hue = sanitizeDegreesDouble(startHue + directionOfRotation * hueAddend);
				if (!TemperatureCache.isBetween(hue, startHue, endHue)) continue;
				const possibleAnswer = this.hctsByHue[Math.round(hue)];
				const relativeTemp = (this.tempsByHct.get(possibleAnswer) - coldestTemp) / range;
				const error = Math.abs(complementRelativeTemp - relativeTemp);
				if (error < smallestError) {
					smallestError = error;
					answer = possibleAnswer;
				}
			}
			this.complementCache = answer;
			return this.complementCache;
		}
		relativeTemperature(hct) {
			const range = this.tempsByHct.get(this.warmest) - this.tempsByHct.get(this.coldest);
			const differenceFromColdest = this.tempsByHct.get(hct) - this.tempsByHct.get(this.coldest);
			if (range === 0) return .5;
			return differenceFromColdest / range;
		}
		get inputRelativeTemperature() {
			if (this.inputRelativeTemperatureCache >= 0) return this.inputRelativeTemperatureCache;
			this.inputRelativeTemperatureCache = this.relativeTemperature(this.input);
			return this.inputRelativeTemperatureCache;
		}
		get tempsByHct() {
			if (this.tempsByHctCache.size > 0) return this.tempsByHctCache;
			const allHcts = this.hctsByHue.concat([this.input]);
			const temperaturesByHct = new Map();
			for (const e of allHcts) temperaturesByHct.set(e, TemperatureCache.rawTemperature(e));
			this.tempsByHctCache = temperaturesByHct;
			return temperaturesByHct;
		}
		get hctsByHue() {
			if (this.hctsByHueCache.length > 0) return this.hctsByHueCache;
			const hcts = [];
			for (let hue = 0; hue <= 360; hue += 1) {
				const colorAtHue = Hct.from(hue, this.input.chroma, this.input.tone);
				hcts.push(colorAtHue);
			}
			this.hctsByHueCache = hcts;
			return this.hctsByHueCache;
		}
		static isBetween(angle, a, b) {
			if (a < b) return a <= angle && angle <= b;
			return a <= angle || angle <= b;
		}
		static rawTemperature(color) {
			const lab = labFromArgb(color.toInt());
			const hue = sanitizeDegreesDouble(Math.atan2(lab[2], lab[1]) * 180 / Math.PI);
			const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
			return -.5 + .02 * Math.pow(chroma, 1.07) * Math.cos(sanitizeDegreesDouble(hue - 50) * Math.PI / 180);
		}
	};
	var ContrastCurve = class {
		constructor(low, normal, medium, high) {
			this.low = low;
			this.normal = normal;
			this.medium = medium;
			this.high = high;
		}
		get(contrastLevel) {
			if (contrastLevel <= -1) return this.low;
			else if (contrastLevel < 0) return lerp(this.low, this.normal, (contrastLevel - -1) / 1);
			else if (contrastLevel < .5) return lerp(this.normal, this.medium, (contrastLevel - 0) / .5);
			else if (contrastLevel < 1) return lerp(this.medium, this.high, (contrastLevel - .5) / .5);
			else return this.high;
		}
	};
	var ToneDeltaPair = class {
		constructor(roleA, roleB, delta, polarity, stayTogether, constraint) {
			this.roleA = roleA;
			this.roleB = roleB;
			this.delta = delta;
			this.polarity = polarity;
			this.stayTogether = stayTogether;
			this.constraint = constraint;
			this.constraint = constraint ?? "exact";
		}
	};
	var Variant;
	(function(Variant) {
		Variant[Variant["MONOCHROME"] = 0] = "MONOCHROME";
		Variant[Variant["NEUTRAL"] = 1] = "NEUTRAL";
		Variant[Variant["TONAL_SPOT"] = 2] = "TONAL_SPOT";
		Variant[Variant["VIBRANT"] = 3] = "VIBRANT";
		Variant[Variant["EXPRESSIVE"] = 4] = "EXPRESSIVE";
		Variant[Variant["FIDELITY"] = 5] = "FIDELITY";
		Variant[Variant["CONTENT"] = 6] = "CONTENT";
		Variant[Variant["RAINBOW"] = 7] = "RAINBOW";
		Variant[Variant["FRUIT_SALAD"] = 8] = "FRUIT_SALAD";
	})(Variant || (Variant = {}));
	function isFidelity(scheme) {
		return scheme.variant === Variant.FIDELITY || scheme.variant === Variant.CONTENT;
	}
	function isMonochrome(scheme) {
		return scheme.variant === Variant.MONOCHROME;
	}
	function findDesiredChromaByTone(hue, chroma, tone, byDecreasingTone) {
		let answer = tone;
		let closestToChroma = Hct.from(hue, chroma, tone);
		if (closestToChroma.chroma < chroma) {
			let chromaPeak = closestToChroma.chroma;
			while (closestToChroma.chroma < chroma) {
				answer += byDecreasingTone ? -1 : 1;
				const potentialSolution = Hct.from(hue, chroma, answer);
				if (chromaPeak > potentialSolution.chroma) break;
				if (Math.abs(potentialSolution.chroma - chroma) < .4) break;
				if (Math.abs(potentialSolution.chroma - chroma) < Math.abs(closestToChroma.chroma - chroma)) closestToChroma = potentialSolution;
				chromaPeak = Math.max(chromaPeak, potentialSolution.chroma);
			}
		}
		return answer;
	}
	var ColorSpecDelegateImpl2021 = class {
		primaryPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "primary_palette_key_color",
				palette: (s) => s.primaryPalette,
				tone: (s) => s.primaryPalette.keyColor.tone
			});
		}
		secondaryPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "secondary_palette_key_color",
				palette: (s) => s.secondaryPalette,
				tone: (s) => s.secondaryPalette.keyColor.tone
			});
		}
		tertiaryPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "tertiary_palette_key_color",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => s.tertiaryPalette.keyColor.tone
			});
		}
		neutralPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "neutral_palette_key_color",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.neutralPalette.keyColor.tone
			});
		}
		neutralVariantPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "neutral_variant_palette_key_color",
				palette: (s) => s.neutralVariantPalette,
				tone: (s) => s.neutralVariantPalette.keyColor.tone
			});
		}
		errorPaletteKeyColor() {
			return DynamicColor.fromPalette({
				name: "error_palette_key_color",
				palette: (s) => s.errorPalette,
				tone: (s) => s.errorPalette.keyColor.tone
			});
		}
		background() {
			return DynamicColor.fromPalette({
				name: "background",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 6 : 98,
				isBackground: true
			});
		}
		onBackground() {
			return DynamicColor.fromPalette({
				name: "on_background",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 90 : 10,
				background: (s) => this.background(),
				contrastCurve: (s) => new ContrastCurve(3, 3, 4.5, 7)
			});
		}
		surface() {
			return DynamicColor.fromPalette({
				name: "surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 6 : 98,
				isBackground: true
			});
		}
		surfaceDim() {
			return DynamicColor.fromPalette({
				name: "surface_dim",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 6 : new ContrastCurve(87, 87, 80, 75).get(s.contrastLevel),
				isBackground: true
			});
		}
		surfaceBright() {
			return DynamicColor.fromPalette({
				name: "surface_bright",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(24, 24, 29, 34).get(s.contrastLevel) : 98,
				isBackground: true
			});
		}
		surfaceContainerLowest() {
			return DynamicColor.fromPalette({
				name: "surface_container_lowest",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(4, 4, 2, 0).get(s.contrastLevel) : 100,
				isBackground: true
			});
		}
		surfaceContainerLow() {
			return DynamicColor.fromPalette({
				name: "surface_container_low",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(10, 10, 11, 12).get(s.contrastLevel) : new ContrastCurve(96, 96, 96, 95).get(s.contrastLevel),
				isBackground: true
			});
		}
		surfaceContainer() {
			return DynamicColor.fromPalette({
				name: "surface_container",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(12, 12, 16, 20).get(s.contrastLevel) : new ContrastCurve(94, 94, 92, 90).get(s.contrastLevel),
				isBackground: true
			});
		}
		surfaceContainerHigh() {
			return DynamicColor.fromPalette({
				name: "surface_container_high",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(17, 17, 21, 25).get(s.contrastLevel) : new ContrastCurve(92, 92, 88, 85).get(s.contrastLevel),
				isBackground: true
			});
		}
		surfaceContainerHighest() {
			return DynamicColor.fromPalette({
				name: "surface_container_highest",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? new ContrastCurve(22, 22, 26, 30).get(s.contrastLevel) : new ContrastCurve(90, 90, 84, 80).get(s.contrastLevel),
				isBackground: true
			});
		}
		onSurface() {
			return DynamicColor.fromPalette({
				name: "on_surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 90 : 10,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		surfaceVariant() {
			return DynamicColor.fromPalette({
				name: "surface_variant",
				palette: (s) => s.neutralVariantPalette,
				tone: (s) => s.isDark ? 30 : 90,
				isBackground: true
			});
		}
		onSurfaceVariant() {
			return DynamicColor.fromPalette({
				name: "on_surface_variant",
				palette: (s) => s.neutralVariantPalette,
				tone: (s) => s.isDark ? 80 : 30,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		inverseSurface() {
			return DynamicColor.fromPalette({
				name: "inverse_surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 90 : 20,
				isBackground: true
			});
		}
		inverseOnSurface() {
			return DynamicColor.fromPalette({
				name: "inverse_on_surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 20 : 95,
				background: (s) => this.inverseSurface(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		outline() {
			return DynamicColor.fromPalette({
				name: "outline",
				palette: (s) => s.neutralVariantPalette,
				tone: (s) => s.isDark ? 60 : 50,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1.5, 3, 4.5, 7)
			});
		}
		outlineVariant() {
			return DynamicColor.fromPalette({
				name: "outline_variant",
				palette: (s) => s.neutralVariantPalette,
				tone: (s) => s.isDark ? 30 : 80,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5)
			});
		}
		shadow() {
			return DynamicColor.fromPalette({
				name: "shadow",
				palette: (s) => s.neutralPalette,
				tone: (s) => 0
			});
		}
		scrim() {
			return DynamicColor.fromPalette({
				name: "scrim",
				palette: (s) => s.neutralPalette,
				tone: (s) => 0
			});
		}
		surfaceTint() {
			return DynamicColor.fromPalette({
				name: "surface_tint",
				palette: (s) => s.primaryPalette,
				tone: (s) => s.isDark ? 80 : 40,
				isBackground: true
			});
		}
		primary() {
			return DynamicColor.fromPalette({
				name: "primary",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 100 : 0;
					return s.isDark ? 80 : 40;
				},
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryContainer(), this.primary(), 10, "nearer", false)
			});
		}
		primaryDim() {}
		onPrimary() {
			return DynamicColor.fromPalette({
				name: "on_primary",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 10 : 90;
					return s.isDark ? 20 : 100;
				},
				background: (s) => this.primary(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		primaryContainer() {
			return DynamicColor.fromPalette({
				name: "primary_container",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (isFidelity(s)) return s.sourceColorHct.tone;
					if (isMonochrome(s)) return s.isDark ? 85 : 25;
					return s.isDark ? 30 : 90;
				},
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryContainer(), this.primary(), 10, "nearer", false)
			});
		}
		onPrimaryContainer() {
			return DynamicColor.fromPalette({
				name: "on_primary_container",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (isFidelity(s)) return DynamicColor.foregroundTone(this.primaryContainer().tone(s), 4.5);
					if (isMonochrome(s)) return s.isDark ? 0 : 100;
					return s.isDark ? 90 : 30;
				},
				background: (s) => this.primaryContainer(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		inversePrimary() {
			return DynamicColor.fromPalette({
				name: "inverse_primary",
				palette: (s) => s.primaryPalette,
				tone: (s) => s.isDark ? 40 : 80,
				background: (s) => this.inverseSurface(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7)
			});
		}
		secondary() {
			return DynamicColor.fromPalette({
				name: "secondary",
				palette: (s) => s.secondaryPalette,
				tone: (s) => s.isDark ? 80 : 40,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 10, "nearer", false)
			});
		}
		secondaryDim() {}
		onSecondary() {
			return DynamicColor.fromPalette({
				name: "on_secondary",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 10 : 100;
					else return s.isDark ? 20 : 100;
				},
				background: (s) => this.secondary(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		secondaryContainer() {
			return DynamicColor.fromPalette({
				name: "secondary_container",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					const initialTone = s.isDark ? 30 : 90;
					if (isMonochrome(s)) return s.isDark ? 30 : 85;
					if (!isFidelity(s)) return initialTone;
					return findDesiredChromaByTone(s.secondaryPalette.hue, s.secondaryPalette.chroma, initialTone, s.isDark ? false : true);
				},
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 10, "nearer", false)
			});
		}
		onSecondaryContainer() {
			return DynamicColor.fromPalette({
				name: "on_secondary_container",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 90 : 10;
					if (!isFidelity(s)) return s.isDark ? 90 : 30;
					return DynamicColor.foregroundTone(this.secondaryContainer().tone(s), 4.5);
				},
				background: (s) => this.secondaryContainer(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		tertiary() {
			return DynamicColor.fromPalette({
				name: "tertiary",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 90 : 25;
					return s.isDark ? 80 : 40;
				},
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 10, "nearer", false)
			});
		}
		tertiaryDim() {}
		onTertiary() {
			return DynamicColor.fromPalette({
				name: "on_tertiary",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 10 : 90;
					return s.isDark ? 20 : 100;
				},
				background: (s) => this.tertiary(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		tertiaryContainer() {
			return DynamicColor.fromPalette({
				name: "tertiary_container",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 60 : 49;
					if (!isFidelity(s)) return s.isDark ? 30 : 90;
					const proposedHct = s.tertiaryPalette.getHct(s.sourceColorHct.tone);
					return DislikeAnalyzer.fixIfDisliked(proposedHct).tone;
				},
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 10, "nearer", false)
			});
		}
		onTertiaryContainer() {
			return DynamicColor.fromPalette({
				name: "on_tertiary_container",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 0 : 100;
					if (!isFidelity(s)) return s.isDark ? 90 : 30;
					return DynamicColor.foregroundTone(this.tertiaryContainer().tone(s), 4.5);
				},
				background: (s) => this.tertiaryContainer(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		error() {
			return DynamicColor.fromPalette({
				name: "error",
				palette: (s) => s.errorPalette,
				tone: (s) => s.isDark ? 80 : 40,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 7),
				toneDeltaPair: (s) => new ToneDeltaPair(this.errorContainer(), this.error(), 10, "nearer", false)
			});
		}
		errorDim() {}
		onError() {
			return DynamicColor.fromPalette({
				name: "on_error",
				palette: (s) => s.errorPalette,
				tone: (s) => s.isDark ? 20 : 100,
				background: (s) => this.error(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		errorContainer() {
			return DynamicColor.fromPalette({
				name: "error_container",
				palette: (s) => s.errorPalette,
				tone: (s) => s.isDark ? 30 : 90,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.errorContainer(), this.error(), 10, "nearer", false)
			});
		}
		onErrorContainer() {
			return DynamicColor.fromPalette({
				name: "on_error_container",
				palette: (s) => s.errorPalette,
				tone: (s) => {
					if (isMonochrome(s)) return s.isDark ? 90 : 10;
					return s.isDark ? 90 : 30;
				},
				background: (s) => this.errorContainer(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		primaryFixed() {
			return DynamicColor.fromPalette({
				name: "primary_fixed",
				palette: (s) => s.primaryPalette,
				tone: (s) => isMonochrome(s) ? 40 : 90,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryFixed(), this.primaryFixedDim(), 10, "lighter", true)
			});
		}
		primaryFixedDim() {
			return DynamicColor.fromPalette({
				name: "primary_fixed_dim",
				palette: (s) => s.primaryPalette,
				tone: (s) => isMonochrome(s) ? 30 : 80,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryFixed(), this.primaryFixedDim(), 10, "lighter", true)
			});
		}
		onPrimaryFixed() {
			return DynamicColor.fromPalette({
				name: "on_primary_fixed",
				palette: (s) => s.primaryPalette,
				tone: (s) => isMonochrome(s) ? 100 : 10,
				background: (s) => this.primaryFixedDim(),
				secondBackground: (s) => this.primaryFixed(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		onPrimaryFixedVariant() {
			return DynamicColor.fromPalette({
				name: "on_primary_fixed_variant",
				palette: (s) => s.primaryPalette,
				tone: (s) => isMonochrome(s) ? 90 : 30,
				background: (s) => this.primaryFixedDim(),
				secondBackground: (s) => this.primaryFixed(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		secondaryFixed() {
			return DynamicColor.fromPalette({
				name: "secondary_fixed",
				palette: (s) => s.secondaryPalette,
				tone: (s) => isMonochrome(s) ? 80 : 90,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryFixed(), this.secondaryFixedDim(), 10, "lighter", true)
			});
		}
		secondaryFixedDim() {
			return DynamicColor.fromPalette({
				name: "secondary_fixed_dim",
				palette: (s) => s.secondaryPalette,
				tone: (s) => isMonochrome(s) ? 70 : 80,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryFixed(), this.secondaryFixedDim(), 10, "lighter", true)
			});
		}
		onSecondaryFixed() {
			return DynamicColor.fromPalette({
				name: "on_secondary_fixed",
				palette: (s) => s.secondaryPalette,
				tone: (s) => 10,
				background: (s) => this.secondaryFixedDim(),
				secondBackground: (s) => this.secondaryFixed(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		onSecondaryFixedVariant() {
			return DynamicColor.fromPalette({
				name: "on_secondary_fixed_variant",
				palette: (s) => s.secondaryPalette,
				tone: (s) => isMonochrome(s) ? 25 : 30,
				background: (s) => this.secondaryFixedDim(),
				secondBackground: (s) => this.secondaryFixed(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		tertiaryFixed() {
			return DynamicColor.fromPalette({
				name: "tertiary_fixed",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => isMonochrome(s) ? 40 : 90,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryFixed(), this.tertiaryFixedDim(), 10, "lighter", true)
			});
		}
		tertiaryFixedDim() {
			return DynamicColor.fromPalette({
				name: "tertiary_fixed_dim",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => isMonochrome(s) ? 30 : 80,
				isBackground: true,
				background: (s) => this.highestSurface(s),
				contrastCurve: (s) => new ContrastCurve(1, 1, 3, 4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryFixed(), this.tertiaryFixedDim(), 10, "lighter", true)
			});
		}
		onTertiaryFixed() {
			return DynamicColor.fromPalette({
				name: "on_tertiary_fixed",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => isMonochrome(s) ? 100 : 10,
				background: (s) => this.tertiaryFixedDim(),
				secondBackground: (s) => this.tertiaryFixed(),
				contrastCurve: (s) => new ContrastCurve(4.5, 7, 11, 21)
			});
		}
		onTertiaryFixedVariant() {
			return DynamicColor.fromPalette({
				name: "on_tertiary_fixed_variant",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => isMonochrome(s) ? 90 : 30,
				background: (s) => this.tertiaryFixedDim(),
				secondBackground: (s) => this.tertiaryFixed(),
				contrastCurve: (s) => new ContrastCurve(3, 4.5, 7, 11)
			});
		}
		highestSurface(s) {
			return s.isDark ? this.surfaceBright() : this.surfaceDim();
		}
	};
	function tMaxC(palette, lowerBound = 0, upperBound = 100, chromaMultiplier = 1) {
		return clampDouble(lowerBound, upperBound, findBestToneForChroma(palette.hue, palette.chroma * chromaMultiplier, 100, true));
	}
	function tMinC(palette, lowerBound = 0, upperBound = 100) {
		return clampDouble(lowerBound, upperBound, findBestToneForChroma(palette.hue, palette.chroma, 0, false));
	}
	function findBestToneForChroma(hue, chroma, tone, byDecreasingTone) {
		let answer = tone;
		let bestCandidate = Hct.from(hue, chroma, answer);
		while (bestCandidate.chroma < chroma) {
			if (tone < 0 || tone > 100) break;
			tone += byDecreasingTone ? -1 : 1;
			const newCandidate = Hct.from(hue, chroma, tone);
			if (bestCandidate.chroma < newCandidate.chroma) {
				bestCandidate = newCandidate;
				answer = tone;
			}
		}
		return answer;
	}
	function getCurve(defaultContrast) {
		if (defaultContrast === 1.5) return new ContrastCurve(1.5, 1.5, 3, 5.5);
		else if (defaultContrast === 3) return new ContrastCurve(3, 3, 4.5, 7);
		else if (defaultContrast === 4.5) return new ContrastCurve(4.5, 4.5, 7, 11);
		else if (defaultContrast === 6) return new ContrastCurve(6, 6, 7, 11);
		else if (defaultContrast === 7) return new ContrastCurve(7, 7, 11, 21);
		else if (defaultContrast === 9) return new ContrastCurve(9, 9, 11, 21);
		else if (defaultContrast === 11) return new ContrastCurve(11, 11, 21, 21);
		else if (defaultContrast === 21) return new ContrastCurve(21, 21, 21, 21);
		else return new ContrastCurve(defaultContrast, defaultContrast, 7, 21);
	}
	var ColorSpecDelegateImpl2025 = class extends ColorSpecDelegateImpl2021 {
		surface() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					super.surface().tone(s);
					if (s.platform === "phone") {
						if (s.isDark) return 4;
						else if (Hct.isYellow(s.neutralPalette.hue)) return 99;
						else if (s.variant === Variant.VIBRANT) return 97;
						else return 98;
					} else return 0;
				},
				isBackground: true
			});
			return extendSpecVersion(super.surface(), "2025", color2025);
		}
		surfaceDim() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_dim",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.isDark) return 4;
					else if (Hct.isYellow(s.neutralPalette.hue)) return 90;
					else if (s.variant === Variant.VIBRANT) return 85;
					else return 87;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (!s.isDark) {
						if (s.variant === Variant.NEUTRAL) return 2.5;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 2.7 : 1.75;
						else if (s.variant === Variant.VIBRANT) return 1.36;
					}
					return 1;
				}
			});
			return extendSpecVersion(super.surfaceDim(), "2025", color2025);
		}
		surfaceBright() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_bright",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.isDark) return 18;
					else if (Hct.isYellow(s.neutralPalette.hue)) return 99;
					else if (s.variant === Variant.VIBRANT) return 97;
					else return 98;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (s.isDark) {
						if (s.variant === Variant.NEUTRAL) return 2.5;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 2.7 : 1.75;
						else if (s.variant === Variant.VIBRANT) return 1.36;
					}
					return 1;
				}
			});
			return extendSpecVersion(super.surfaceBright(), "2025", color2025);
		}
		surfaceContainerLowest() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_container_lowest",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 0 : 100,
				isBackground: true
			});
			return extendSpecVersion(super.surfaceContainerLowest(), "2025", color2025);
		}
		surfaceContainerLow() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_container_low",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.platform === "phone") {
						if (s.isDark) return 6;
						else if (Hct.isYellow(s.neutralPalette.hue)) return 98;
						else if (s.variant === Variant.VIBRANT) return 95;
						else return 96;
					} else return 15;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 1.3;
						else if (s.variant === Variant.TONAL_SPOT) return 1.25;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 1.3 : 1.15;
						else if (s.variant === Variant.VIBRANT) return 1.08;
					}
					return 1;
				}
			});
			return extendSpecVersion(super.surfaceContainerLow(), "2025", color2025);
		}
		surfaceContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_container",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.platform === "phone") {
						if (s.isDark) return 9;
						else if (Hct.isYellow(s.neutralPalette.hue)) return 96;
						else if (s.variant === Variant.VIBRANT) return 92;
						else return 94;
					} else return 20;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 1.6;
						else if (s.variant === Variant.TONAL_SPOT) return 1.4;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 1.6 : 1.3;
						else if (s.variant === Variant.VIBRANT) return 1.15;
					}
					return 1;
				}
			});
			return extendSpecVersion(super.surfaceContainer(), "2025", color2025);
		}
		surfaceContainerHigh() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_container_high",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.platform === "phone") {
						if (s.isDark) return 12;
						else if (Hct.isYellow(s.neutralPalette.hue)) return 94;
						else if (s.variant === Variant.VIBRANT) return 90;
						else return 92;
					} else return 25;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 1.9;
						else if (s.variant === Variant.TONAL_SPOT) return 1.5;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 1.95 : 1.45;
						else if (s.variant === Variant.VIBRANT) return 1.22;
					}
					return 1;
				}
			});
			return extendSpecVersion(super.surfaceContainerHigh(), "2025", color2025);
		}
		surfaceContainerHighest() {
			const color2025 = DynamicColor.fromPalette({
				name: "surface_container_highest",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.isDark) return 15;
					else if (Hct.isYellow(s.neutralPalette.hue)) return 92;
					else if (s.variant === Variant.VIBRANT) return 88;
					else return 90;
				},
				isBackground: true,
				chromaMultiplier: (s) => {
					if (s.variant === Variant.NEUTRAL) return 2.2;
					else if (s.variant === Variant.TONAL_SPOT) return 1.7;
					else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? 2.3 : 1.6;
					else if (s.variant === Variant.VIBRANT) return 1.29;
					else return 1;
				}
			});
			return extendSpecVersion(super.surfaceContainerHighest(), "2025", color2025);
		}
		onSurface() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => {
					if (s.variant === Variant.VIBRANT) return tMaxC(s.neutralPalette, 0, 100, 1.1);
					else return DynamicColor.getInitialToneFromBackground((s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh())(s);
				},
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 2.2;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? s.isDark ? 3 : 2.3 : 1.6;
					}
					return 1;
				},
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.isDark && s.platform === "phone" ? getCurve(11) : getCurve(9)
			});
			return extendSpecVersion(super.onSurface(), "2025", color2025);
		}
		onSurfaceVariant() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_surface_variant",
				palette: (s) => s.neutralPalette,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 2.2;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? s.isDark ? 3 : 2.3 : 1.6;
					}
					return 1;
				},
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? s.isDark ? getCurve(6) : getCurve(4.5) : getCurve(7)
			});
			return extendSpecVersion(super.onSurfaceVariant(), "2025", color2025);
		}
		outline() {
			const color2025 = DynamicColor.fromPalette({
				name: "outline",
				palette: (s) => s.neutralPalette,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 2.2;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? s.isDark ? 3 : 2.3 : 1.6;
					}
					return 1;
				},
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(3) : getCurve(4.5)
			});
			return extendSpecVersion(super.outline(), "2025", color2025);
		}
		outlineVariant() {
			const color2025 = DynamicColor.fromPalette({
				name: "outline_variant",
				palette: (s) => s.neutralPalette,
				chromaMultiplier: (s) => {
					if (s.platform === "phone") {
						if (s.variant === Variant.NEUTRAL) return 2.2;
						else if (s.variant === Variant.TONAL_SPOT) return 1.7;
						else if (s.variant === Variant.EXPRESSIVE) return Hct.isYellow(s.neutralPalette.hue) ? s.isDark ? 3 : 2.3 : 1.6;
					}
					return 1;
				},
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(1.5) : getCurve(3)
			});
			return extendSpecVersion(super.outlineVariant(), "2025", color2025);
		}
		inverseSurface() {
			const color2025 = DynamicColor.fromPalette({
				name: "inverse_surface",
				palette: (s) => s.neutralPalette,
				tone: (s) => s.isDark ? 98 : 4,
				isBackground: true
			});
			return extendSpecVersion(super.inverseSurface(), "2025", color2025);
		}
		inverseOnSurface() {
			const color2025 = DynamicColor.fromPalette({
				name: "inverse_on_surface",
				palette: (s) => s.neutralPalette,
				background: (s) => this.inverseSurface(),
				contrastCurve: (s) => getCurve(7)
			});
			return extendSpecVersion(super.inverseOnSurface(), "2025", color2025);
		}
		primary() {
			const color2025 = DynamicColor.fromPalette({
				name: "primary",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (s.variant === Variant.NEUTRAL) {
						if (s.platform === "phone") return s.isDark ? 80 : 40;
						else return 90;
					} else if (s.variant === Variant.TONAL_SPOT) {
						if (s.platform === "phone") {
							if (s.isDark) return 80;
							else return tMaxC(s.primaryPalette);
						} else return tMaxC(s.primaryPalette, 0, 90);
					} else if (s.variant === Variant.EXPRESSIVE) {
						if (s.platform === "phone") return tMaxC(s.primaryPalette, 0, Hct.isYellow(s.primaryPalette.hue) ? 25 : Hct.isCyan(s.primaryPalette.hue) ? 88 : 98);
						else return tMaxC(s.primaryPalette);
					} else if (s.platform === "phone") return tMaxC(s.primaryPalette, 0, Hct.isCyan(s.primaryPalette.hue) ? 88 : 98);
					else return tMaxC(s.primaryPalette);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(4.5) : getCurve(7),
				toneDeltaPair: (s) => s.platform === "phone" ? new ToneDeltaPair(this.primaryContainer(), this.primary(), 5, "relative_lighter", true, "farther") : void 0
			});
			return extendSpecVersion(super.primary(), "2025", color2025);
		}
		primaryDim() {
			return DynamicColor.fromPalette({
				name: "primary_dim",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (s.variant === Variant.NEUTRAL) return 85;
					else if (s.variant === Variant.TONAL_SPOT) return tMaxC(s.primaryPalette, 0, 90);
					else return tMaxC(s.primaryPalette);
				},
				isBackground: true,
				background: (s) => this.surfaceContainerHigh(),
				contrastCurve: (s) => getCurve(4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryDim(), this.primary(), 5, "darker", true, "farther")
			});
		}
		onPrimary() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_primary",
				palette: (s) => s.primaryPalette,
				background: (s) => s.platform === "phone" ? this.primary() : this.primaryDim(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onPrimary(), "2025", color2025);
		}
		primaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "primary_container",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					if (s.platform === "watch") return 30;
					else if (s.variant === Variant.NEUTRAL) return s.isDark ? 30 : 90;
					else if (s.variant === Variant.TONAL_SPOT) return s.isDark ? tMinC(s.primaryPalette, 35, 93) : tMaxC(s.primaryPalette, 0, 90);
					else if (s.variant === Variant.EXPRESSIVE) return s.isDark ? tMaxC(s.primaryPalette, 30, 93) : tMaxC(s.primaryPalette, 78, Hct.isCyan(s.primaryPalette.hue) ? 88 : 90);
					else return s.isDark ? tMinC(s.primaryPalette, 66, 93) : tMaxC(s.primaryPalette, 66, Hct.isCyan(s.primaryPalette.hue) ? 88 : 93);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				toneDeltaPair: (s) => s.platform === "phone" ? void 0 : new ToneDeltaPair(this.primaryContainer(), this.primaryDim(), 10, "darker", true, "farther"),
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.primaryContainer(), "2025", color2025);
		}
		onPrimaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_primary_container",
				palette: (s) => s.primaryPalette,
				background: (s) => this.primaryContainer(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onPrimaryContainer(), "2025", color2025);
		}
		primaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "primary_fixed",
				palette: (s) => s.primaryPalette,
				tone: (s) => {
					let tempS = Object.assign({}, s, {
						isDark: false,
						contrastLevel: 0
					});
					return this.primaryContainer().getTone(tempS);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.primaryFixed(), "2025", color2025);
		}
		primaryFixedDim() {
			const color2025 = DynamicColor.fromPalette({
				name: "primary_fixed_dim",
				palette: (s) => s.primaryPalette,
				tone: (s) => this.primaryFixed().getTone(s),
				isBackground: true,
				toneDeltaPair: (s) => new ToneDeltaPair(this.primaryFixedDim(), this.primaryFixed(), 5, "darker", true, "exact")
			});
			return extendSpecVersion(super.primaryFixedDim(), "2025", color2025);
		}
		onPrimaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_primary_fixed",
				palette: (s) => s.primaryPalette,
				background: (s) => this.primaryFixedDim(),
				contrastCurve: (s) => getCurve(7)
			});
			return extendSpecVersion(super.onPrimaryFixed(), "2025", color2025);
		}
		onPrimaryFixedVariant() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_primary_fixed_variant",
				palette: (s) => s.primaryPalette,
				background: (s) => this.primaryFixedDim(),
				contrastCurve: (s) => getCurve(4.5)
			});
			return extendSpecVersion(super.onPrimaryFixedVariant(), "2025", color2025);
		}
		inversePrimary() {
			const color2025 = DynamicColor.fromPalette({
				name: "inverse_primary",
				palette: (s) => s.primaryPalette,
				tone: (s) => tMaxC(s.primaryPalette),
				background: (s) => this.inverseSurface(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.inversePrimary(), "2025", color2025);
		}
		secondary() {
			const color2025 = DynamicColor.fromPalette({
				name: "secondary",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					if (s.platform === "watch") return s.variant === Variant.NEUTRAL ? 90 : tMaxC(s.secondaryPalette, 0, 90);
					else if (s.variant === Variant.NEUTRAL) return s.isDark ? tMinC(s.secondaryPalette, 0, 98) : tMaxC(s.secondaryPalette);
					else if (s.variant === Variant.VIBRANT) return tMaxC(s.secondaryPalette, 0, s.isDark ? 90 : 98);
					else return s.isDark ? 80 : tMaxC(s.secondaryPalette);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(4.5) : getCurve(7),
				toneDeltaPair: (s) => s.platform === "phone" ? new ToneDeltaPair(this.secondaryContainer(), this.secondary(), 5, "relative_lighter", true, "farther") : void 0
			});
			return extendSpecVersion(super.secondary(), "2025", color2025);
		}
		secondaryDim() {
			return DynamicColor.fromPalette({
				name: "secondary_dim",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					if (s.variant === Variant.NEUTRAL) return 85;
					else return tMaxC(s.secondaryPalette, 0, 90);
				},
				isBackground: true,
				background: (s) => this.surfaceContainerHigh(),
				contrastCurve: (s) => getCurve(4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryDim(), this.secondary(), 5, "darker", true, "farther")
			});
		}
		onSecondary() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_secondary",
				palette: (s) => s.secondaryPalette,
				background: (s) => s.platform === "phone" ? this.secondary() : this.secondaryDim(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onSecondary(), "2025", color2025);
		}
		secondaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "secondary_container",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					if (s.platform === "watch") return 30;
					else if (s.variant === Variant.VIBRANT) return s.isDark ? tMinC(s.secondaryPalette, 30, 40) : tMaxC(s.secondaryPalette, 84, 90);
					else if (s.variant === Variant.EXPRESSIVE) return s.isDark ? 15 : tMaxC(s.secondaryPalette, 90, 95);
					else return s.isDark ? 25 : 90;
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				toneDeltaPair: (s) => s.platform === "watch" ? new ToneDeltaPair(this.secondaryContainer(), this.secondaryDim(), 10, "darker", true, "farther") : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.secondaryContainer(), "2025", color2025);
		}
		onSecondaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_secondary_container",
				palette: (s) => s.secondaryPalette,
				background: (s) => this.secondaryContainer(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onSecondaryContainer(), "2025", color2025);
		}
		secondaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "secondary_fixed",
				palette: (s) => s.secondaryPalette,
				tone: (s) => {
					let tempS = Object.assign({}, s, {
						isDark: false,
						contrastLevel: 0
					});
					return this.secondaryContainer().getTone(tempS);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.secondaryFixed(), "2025", color2025);
		}
		secondaryFixedDim() {
			const color2025 = DynamicColor.fromPalette({
				name: "secondary_fixed_dim",
				palette: (s) => s.secondaryPalette,
				tone: (s) => this.secondaryFixed().getTone(s),
				isBackground: true,
				toneDeltaPair: (s) => new ToneDeltaPair(this.secondaryFixedDim(), this.secondaryFixed(), 5, "darker", true, "exact")
			});
			return extendSpecVersion(super.secondaryFixedDim(), "2025", color2025);
		}
		onSecondaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_secondary_fixed",
				palette: (s) => s.secondaryPalette,
				background: (s) => this.secondaryFixedDim(),
				contrastCurve: (s) => getCurve(7)
			});
			return extendSpecVersion(super.onSecondaryFixed(), "2025", color2025);
		}
		onSecondaryFixedVariant() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_secondary_fixed_variant",
				palette: (s) => s.secondaryPalette,
				background: (s) => this.secondaryFixedDim(),
				contrastCurve: (s) => getCurve(4.5)
			});
			return extendSpecVersion(super.onSecondaryFixedVariant(), "2025", color2025);
		}
		tertiary() {
			const color2025 = DynamicColor.fromPalette({
				name: "tertiary",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (s.platform === "watch") return s.variant === Variant.TONAL_SPOT ? tMaxC(s.tertiaryPalette, 0, 90) : tMaxC(s.tertiaryPalette);
					else if (s.variant === Variant.EXPRESSIVE || s.variant === Variant.VIBRANT) return tMaxC(s.tertiaryPalette, 0, Hct.isCyan(s.tertiaryPalette.hue) ? 88 : s.isDark ? 98 : 100);
					else return s.isDark ? tMaxC(s.tertiaryPalette, 0, 98) : tMaxC(s.tertiaryPalette);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(4.5) : getCurve(7),
				toneDeltaPair: (s) => s.platform === "phone" ? new ToneDeltaPair(this.tertiaryContainer(), this.tertiary(), 5, "relative_lighter", true, "farther") : void 0
			});
			return extendSpecVersion(super.tertiary(), "2025", color2025);
		}
		tertiaryDim() {
			return DynamicColor.fromPalette({
				name: "tertiary_dim",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (s.variant === Variant.TONAL_SPOT) return tMaxC(s.tertiaryPalette, 0, 90);
					else return tMaxC(s.tertiaryPalette);
				},
				isBackground: true,
				background: (s) => this.surfaceContainerHigh(),
				contrastCurve: (s) => getCurve(4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryDim(), this.tertiary(), 5, "darker", true, "farther")
			});
		}
		onTertiary() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_tertiary",
				palette: (s) => s.tertiaryPalette,
				background: (s) => s.platform === "phone" ? this.tertiary() : this.tertiaryDim(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onTertiary(), "2025", color2025);
		}
		tertiaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "tertiary_container",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					if (s.platform === "watch") return s.variant === Variant.TONAL_SPOT ? tMaxC(s.tertiaryPalette, 0, 90) : tMaxC(s.tertiaryPalette);
					else if (s.variant === Variant.NEUTRAL) return s.isDark ? tMaxC(s.tertiaryPalette, 0, 93) : tMaxC(s.tertiaryPalette, 0, 96);
					else if (s.variant === Variant.TONAL_SPOT) return tMaxC(s.tertiaryPalette, 0, s.isDark ? 93 : 100);
					else if (s.variant === Variant.EXPRESSIVE) return tMaxC(s.tertiaryPalette, 75, Hct.isCyan(s.tertiaryPalette.hue) ? 88 : s.isDark ? 93 : 100);
					else return s.isDark ? tMaxC(s.tertiaryPalette, 0, 93) : tMaxC(s.tertiaryPalette, 72, 100);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				toneDeltaPair: (s) => s.platform === "watch" ? new ToneDeltaPair(this.tertiaryContainer(), this.tertiaryDim(), 10, "darker", true, "farther") : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.tertiaryContainer(), "2025", color2025);
		}
		onTertiaryContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_tertiary_container",
				palette: (s) => s.tertiaryPalette,
				background: (s) => this.tertiaryContainer(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onTertiaryContainer(), "2025", color2025);
		}
		tertiaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "tertiary_fixed",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => {
					let tempS = Object.assign({}, s, {
						isDark: false,
						contrastLevel: 0
					});
					return this.tertiaryContainer().getTone(tempS);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.tertiaryFixed(), "2025", color2025);
		}
		tertiaryFixedDim() {
			const color2025 = DynamicColor.fromPalette({
				name: "tertiary_fixed_dim",
				palette: (s) => s.tertiaryPalette,
				tone: (s) => this.tertiaryFixed().getTone(s),
				isBackground: true,
				toneDeltaPair: (s) => new ToneDeltaPair(this.tertiaryFixedDim(), this.tertiaryFixed(), 5, "darker", true, "exact")
			});
			return extendSpecVersion(super.tertiaryFixedDim(), "2025", color2025);
		}
		onTertiaryFixed() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_tertiary_fixed",
				palette: (s) => s.tertiaryPalette,
				background: (s) => this.tertiaryFixedDim(),
				contrastCurve: (s) => getCurve(7)
			});
			return extendSpecVersion(super.onTertiaryFixed(), "2025", color2025);
		}
		onTertiaryFixedVariant() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_tertiary_fixed_variant",
				palette: (s) => s.tertiaryPalette,
				background: (s) => this.tertiaryFixedDim(),
				contrastCurve: (s) => getCurve(4.5)
			});
			return extendSpecVersion(super.onTertiaryFixedVariant(), "2025", color2025);
		}
		error() {
			const color2025 = DynamicColor.fromPalette({
				name: "error",
				palette: (s) => s.errorPalette,
				tone: (s) => {
					if (s.platform === "phone") return s.isDark ? tMinC(s.errorPalette, 0, 98) : tMaxC(s.errorPalette);
					else return tMinC(s.errorPalette);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : this.surfaceContainerHigh(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(4.5) : getCurve(7),
				toneDeltaPair: (s) => s.platform === "phone" ? new ToneDeltaPair(this.errorContainer(), this.error(), 5, "relative_lighter", true, "farther") : void 0
			});
			return extendSpecVersion(super.error(), "2025", color2025);
		}
		errorDim() {
			return DynamicColor.fromPalette({
				name: "error_dim",
				palette: (s) => s.errorPalette,
				tone: (s) => tMinC(s.errorPalette),
				isBackground: true,
				background: (s) => this.surfaceContainerHigh(),
				contrastCurve: (s) => getCurve(4.5),
				toneDeltaPair: (s) => new ToneDeltaPair(this.errorDim(), this.error(), 5, "darker", true, "farther")
			});
		}
		onError() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_error",
				palette: (s) => s.errorPalette,
				background: (s) => s.platform === "phone" ? this.error() : this.errorDim(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(6) : getCurve(7)
			});
			return extendSpecVersion(super.onError(), "2025", color2025);
		}
		errorContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "error_container",
				palette: (s) => s.errorPalette,
				tone: (s) => {
					if (s.platform === "watch") return 30;
					else return s.isDark ? tMinC(s.errorPalette, 30, 93) : tMaxC(s.errorPalette, 0, 90);
				},
				isBackground: true,
				background: (s) => s.platform === "phone" ? this.highestSurface(s) : void 0,
				toneDeltaPair: (s) => s.platform === "watch" ? new ToneDeltaPair(this.errorContainer(), this.errorDim(), 10, "darker", true, "farther") : void 0,
				contrastCurve: (s) => s.platform === "phone" && s.contrastLevel > 0 ? getCurve(1.5) : void 0
			});
			return extendSpecVersion(super.errorContainer(), "2025", color2025);
		}
		onErrorContainer() {
			const color2025 = DynamicColor.fromPalette({
				name: "on_error_container",
				palette: (s) => s.errorPalette,
				background: (s) => this.errorContainer(),
				contrastCurve: (s) => s.platform === "phone" ? getCurve(4.5) : getCurve(7)
			});
			return extendSpecVersion(super.onErrorContainer(), "2025", color2025);
		}
		surfaceVariant() {
			const color2025 = Object.assign(this.surfaceContainerHighest().clone(), { name: "surface_variant" });
			return extendSpecVersion(super.surfaceVariant(), "2025", color2025);
		}
		surfaceTint() {
			const color2025 = Object.assign(this.primary().clone(), { name: "surface_tint" });
			return extendSpecVersion(super.surfaceTint(), "2025", color2025);
		}
		background() {
			const color2025 = Object.assign(this.surface().clone(), { name: "background" });
			return extendSpecVersion(super.background(), "2025", color2025);
		}
		onBackground() {
			const color2025 = Object.assign(this.onSurface().clone(), {
				name: "on_background",
				tone: (s) => {
					return s.platform === "watch" ? 100 : this.onSurface().getTone(s);
				}
			});
			return extendSpecVersion(super.onBackground(), "2025", color2025);
		}
	};
	var MaterialDynamicColors = class MaterialDynamicColors {
		constructor() {
			this.allColors = [
				this.background(),
				this.onBackground(),
				this.surface(),
				this.surfaceDim(),
				this.surfaceBright(),
				this.surfaceContainerLowest(),
				this.surfaceContainerLow(),
				this.surfaceContainer(),
				this.surfaceContainerHigh(),
				this.surfaceContainerHighest(),
				this.onSurface(),
				this.onSurfaceVariant(),
				this.outline(),
				this.outlineVariant(),
				this.inverseSurface(),
				this.inverseOnSurface(),
				this.primary(),
				this.primaryDim(),
				this.onPrimary(),
				this.primaryContainer(),
				this.onPrimaryContainer(),
				this.primaryFixed(),
				this.primaryFixedDim(),
				this.onPrimaryFixed(),
				this.onPrimaryFixedVariant(),
				this.inversePrimary(),
				this.secondary(),
				this.secondaryDim(),
				this.onSecondary(),
				this.secondaryContainer(),
				this.onSecondaryContainer(),
				this.secondaryFixed(),
				this.secondaryFixedDim(),
				this.onSecondaryFixed(),
				this.onSecondaryFixedVariant(),
				this.tertiary(),
				this.tertiaryDim(),
				this.onTertiary(),
				this.tertiaryContainer(),
				this.onTertiaryContainer(),
				this.tertiaryFixed(),
				this.tertiaryFixedDim(),
				this.onTertiaryFixed(),
				this.onTertiaryFixedVariant(),
				this.error(),
				this.errorDim(),
				this.onError(),
				this.errorContainer(),
				this.onErrorContainer()
			].filter((c) => c !== void 0);
		}
		highestSurface(s) {
			return MaterialDynamicColors.colorSpec.highestSurface(s);
		}
		primaryPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.primaryPaletteKeyColor();
		}
		secondaryPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.secondaryPaletteKeyColor();
		}
		tertiaryPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.tertiaryPaletteKeyColor();
		}
		neutralPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.neutralPaletteKeyColor();
		}
		neutralVariantPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.neutralVariantPaletteKeyColor();
		}
		errorPaletteKeyColor() {
			return MaterialDynamicColors.colorSpec.errorPaletteKeyColor();
		}
		background() {
			return MaterialDynamicColors.colorSpec.background();
		}
		onBackground() {
			return MaterialDynamicColors.colorSpec.onBackground();
		}
		surface() {
			return MaterialDynamicColors.colorSpec.surface();
		}
		surfaceDim() {
			return MaterialDynamicColors.colorSpec.surfaceDim();
		}
		surfaceBright() {
			return MaterialDynamicColors.colorSpec.surfaceBright();
		}
		surfaceContainerLowest() {
			return MaterialDynamicColors.colorSpec.surfaceContainerLowest();
		}
		surfaceContainerLow() {
			return MaterialDynamicColors.colorSpec.surfaceContainerLow();
		}
		surfaceContainer() {
			return MaterialDynamicColors.colorSpec.surfaceContainer();
		}
		surfaceContainerHigh() {
			return MaterialDynamicColors.colorSpec.surfaceContainerHigh();
		}
		surfaceContainerHighest() {
			return MaterialDynamicColors.colorSpec.surfaceContainerHighest();
		}
		onSurface() {
			return MaterialDynamicColors.colorSpec.onSurface();
		}
		surfaceVariant() {
			return MaterialDynamicColors.colorSpec.surfaceVariant();
		}
		onSurfaceVariant() {
			return MaterialDynamicColors.colorSpec.onSurfaceVariant();
		}
		outline() {
			return MaterialDynamicColors.colorSpec.outline();
		}
		outlineVariant() {
			return MaterialDynamicColors.colorSpec.outlineVariant();
		}
		inverseSurface() {
			return MaterialDynamicColors.colorSpec.inverseSurface();
		}
		inverseOnSurface() {
			return MaterialDynamicColors.colorSpec.inverseOnSurface();
		}
		shadow() {
			return MaterialDynamicColors.colorSpec.shadow();
		}
		scrim() {
			return MaterialDynamicColors.colorSpec.scrim();
		}
		surfaceTint() {
			return MaterialDynamicColors.colorSpec.surfaceTint();
		}
		primary() {
			return MaterialDynamicColors.colorSpec.primary();
		}
		primaryDim() {
			return MaterialDynamicColors.colorSpec.primaryDim();
		}
		onPrimary() {
			return MaterialDynamicColors.colorSpec.onPrimary();
		}
		primaryContainer() {
			return MaterialDynamicColors.colorSpec.primaryContainer();
		}
		onPrimaryContainer() {
			return MaterialDynamicColors.colorSpec.onPrimaryContainer();
		}
		inversePrimary() {
			return MaterialDynamicColors.colorSpec.inversePrimary();
		}
		primaryFixed() {
			return MaterialDynamicColors.colorSpec.primaryFixed();
		}
		primaryFixedDim() {
			return MaterialDynamicColors.colorSpec.primaryFixedDim();
		}
		onPrimaryFixed() {
			return MaterialDynamicColors.colorSpec.onPrimaryFixed();
		}
		onPrimaryFixedVariant() {
			return MaterialDynamicColors.colorSpec.onPrimaryFixedVariant();
		}
		secondary() {
			return MaterialDynamicColors.colorSpec.secondary();
		}
		secondaryDim() {
			return MaterialDynamicColors.colorSpec.secondaryDim();
		}
		onSecondary() {
			return MaterialDynamicColors.colorSpec.onSecondary();
		}
		secondaryContainer() {
			return MaterialDynamicColors.colorSpec.secondaryContainer();
		}
		onSecondaryContainer() {
			return MaterialDynamicColors.colorSpec.onSecondaryContainer();
		}
		secondaryFixed() {
			return MaterialDynamicColors.colorSpec.secondaryFixed();
		}
		secondaryFixedDim() {
			return MaterialDynamicColors.colorSpec.secondaryFixedDim();
		}
		onSecondaryFixed() {
			return MaterialDynamicColors.colorSpec.onSecondaryFixed();
		}
		onSecondaryFixedVariant() {
			return MaterialDynamicColors.colorSpec.onSecondaryFixedVariant();
		}
		tertiary() {
			return MaterialDynamicColors.colorSpec.tertiary();
		}
		tertiaryDim() {
			return MaterialDynamicColors.colorSpec.tertiaryDim();
		}
		onTertiary() {
			return MaterialDynamicColors.colorSpec.onTertiary();
		}
		tertiaryContainer() {
			return MaterialDynamicColors.colorSpec.tertiaryContainer();
		}
		onTertiaryContainer() {
			return MaterialDynamicColors.colorSpec.onTertiaryContainer();
		}
		tertiaryFixed() {
			return MaterialDynamicColors.colorSpec.tertiaryFixed();
		}
		tertiaryFixedDim() {
			return MaterialDynamicColors.colorSpec.tertiaryFixedDim();
		}
		onTertiaryFixed() {
			return MaterialDynamicColors.colorSpec.onTertiaryFixed();
		}
		onTertiaryFixedVariant() {
			return MaterialDynamicColors.colorSpec.onTertiaryFixedVariant();
		}
		error() {
			return MaterialDynamicColors.colorSpec.error();
		}
		errorDim() {
			return MaterialDynamicColors.colorSpec.errorDim();
		}
		onError() {
			return MaterialDynamicColors.colorSpec.onError();
		}
		errorContainer() {
			return MaterialDynamicColors.colorSpec.errorContainer();
		}
		onErrorContainer() {
			return MaterialDynamicColors.colorSpec.onErrorContainer();
		}
		static highestSurface(s) {
			return MaterialDynamicColors.colorSpec.highestSurface(s);
		}
	};
	MaterialDynamicColors.contentAccentToneDelta = 15;
	MaterialDynamicColors.colorSpec = new ColorSpecDelegateImpl2025();
	MaterialDynamicColors.primaryPaletteKeyColor = MaterialDynamicColors.colorSpec.primaryPaletteKeyColor();
	MaterialDynamicColors.secondaryPaletteKeyColor = MaterialDynamicColors.colorSpec.secondaryPaletteKeyColor();
	MaterialDynamicColors.tertiaryPaletteKeyColor = MaterialDynamicColors.colorSpec.tertiaryPaletteKeyColor();
	MaterialDynamicColors.neutralPaletteKeyColor = MaterialDynamicColors.colorSpec.neutralPaletteKeyColor();
	MaterialDynamicColors.neutralVariantPaletteKeyColor = MaterialDynamicColors.colorSpec.neutralVariantPaletteKeyColor();
	MaterialDynamicColors.background = MaterialDynamicColors.colorSpec.background();
	MaterialDynamicColors.onBackground = MaterialDynamicColors.colorSpec.onBackground();
	MaterialDynamicColors.surface = MaterialDynamicColors.colorSpec.surface();
	MaterialDynamicColors.surfaceDim = MaterialDynamicColors.colorSpec.surfaceDim();
	MaterialDynamicColors.surfaceBright = MaterialDynamicColors.colorSpec.surfaceBright();
	MaterialDynamicColors.surfaceContainerLowest = MaterialDynamicColors.colorSpec.surfaceContainerLowest();
	MaterialDynamicColors.surfaceContainerLow = MaterialDynamicColors.colorSpec.surfaceContainerLow();
	MaterialDynamicColors.surfaceContainer = MaterialDynamicColors.colorSpec.surfaceContainer();
	MaterialDynamicColors.surfaceContainerHigh = MaterialDynamicColors.colorSpec.surfaceContainerHigh();
	MaterialDynamicColors.surfaceContainerHighest = MaterialDynamicColors.colorSpec.surfaceContainerHighest();
	MaterialDynamicColors.onSurface = MaterialDynamicColors.colorSpec.onSurface();
	MaterialDynamicColors.surfaceVariant = MaterialDynamicColors.colorSpec.surfaceVariant();
	MaterialDynamicColors.onSurfaceVariant = MaterialDynamicColors.colorSpec.onSurfaceVariant();
	MaterialDynamicColors.inverseSurface = MaterialDynamicColors.colorSpec.inverseSurface();
	MaterialDynamicColors.inverseOnSurface = MaterialDynamicColors.colorSpec.inverseOnSurface();
	MaterialDynamicColors.outline = MaterialDynamicColors.colorSpec.outline();
	MaterialDynamicColors.outlineVariant = MaterialDynamicColors.colorSpec.outlineVariant();
	MaterialDynamicColors.shadow = MaterialDynamicColors.colorSpec.shadow();
	MaterialDynamicColors.scrim = MaterialDynamicColors.colorSpec.scrim();
	MaterialDynamicColors.surfaceTint = MaterialDynamicColors.colorSpec.surfaceTint();
	MaterialDynamicColors.primary = MaterialDynamicColors.colorSpec.primary();
	MaterialDynamicColors.onPrimary = MaterialDynamicColors.colorSpec.onPrimary();
	MaterialDynamicColors.primaryContainer = MaterialDynamicColors.colorSpec.primaryContainer();
	MaterialDynamicColors.onPrimaryContainer = MaterialDynamicColors.colorSpec.onPrimaryContainer();
	MaterialDynamicColors.inversePrimary = MaterialDynamicColors.colorSpec.inversePrimary();
	MaterialDynamicColors.secondary = MaterialDynamicColors.colorSpec.secondary();
	MaterialDynamicColors.onSecondary = MaterialDynamicColors.colorSpec.onSecondary();
	MaterialDynamicColors.secondaryContainer = MaterialDynamicColors.colorSpec.secondaryContainer();
	MaterialDynamicColors.onSecondaryContainer = MaterialDynamicColors.colorSpec.onSecondaryContainer();
	MaterialDynamicColors.tertiary = MaterialDynamicColors.colorSpec.tertiary();
	MaterialDynamicColors.onTertiary = MaterialDynamicColors.colorSpec.onTertiary();
	MaterialDynamicColors.tertiaryContainer = MaterialDynamicColors.colorSpec.tertiaryContainer();
	MaterialDynamicColors.onTertiaryContainer = MaterialDynamicColors.colorSpec.onTertiaryContainer();
	MaterialDynamicColors.error = MaterialDynamicColors.colorSpec.error();
	MaterialDynamicColors.onError = MaterialDynamicColors.colorSpec.onError();
	MaterialDynamicColors.errorContainer = MaterialDynamicColors.colorSpec.errorContainer();
	MaterialDynamicColors.onErrorContainer = MaterialDynamicColors.colorSpec.onErrorContainer();
	MaterialDynamicColors.primaryFixed = MaterialDynamicColors.colorSpec.primaryFixed();
	MaterialDynamicColors.primaryFixedDim = MaterialDynamicColors.colorSpec.primaryFixedDim();
	MaterialDynamicColors.onPrimaryFixed = MaterialDynamicColors.colorSpec.onPrimaryFixed();
	MaterialDynamicColors.onPrimaryFixedVariant = MaterialDynamicColors.colorSpec.onPrimaryFixedVariant();
	MaterialDynamicColors.secondaryFixed = MaterialDynamicColors.colorSpec.secondaryFixed();
	MaterialDynamicColors.secondaryFixedDim = MaterialDynamicColors.colorSpec.secondaryFixedDim();
	MaterialDynamicColors.onSecondaryFixed = MaterialDynamicColors.colorSpec.onSecondaryFixed();
	MaterialDynamicColors.onSecondaryFixedVariant = MaterialDynamicColors.colorSpec.onSecondaryFixedVariant();
	MaterialDynamicColors.tertiaryFixed = MaterialDynamicColors.colorSpec.tertiaryFixed();
	MaterialDynamicColors.tertiaryFixedDim = MaterialDynamicColors.colorSpec.tertiaryFixedDim();
	MaterialDynamicColors.onTertiaryFixed = MaterialDynamicColors.colorSpec.onTertiaryFixed();
	MaterialDynamicColors.onTertiaryFixedVariant = MaterialDynamicColors.colorSpec.onTertiaryFixedVariant();
	var DynamicScheme = class DynamicScheme {
		static maybeFallbackSpecVersion(specVersion, variant) {
			switch (variant) {
				case Variant.EXPRESSIVE:
				case Variant.VIBRANT:
				case Variant.TONAL_SPOT:
				case Variant.NEUTRAL: return specVersion;
				default: return "2021";
			}
		}
		constructor(args) {
			this.sourceColorArgb = args.sourceColorHct.toInt();
			this.variant = args.variant;
			this.contrastLevel = args.contrastLevel;
			this.isDark = args.isDark;
			this.platform = args.platform ?? "phone";
			this.specVersion = DynamicScheme.maybeFallbackSpecVersion(args.specVersion ?? "2021", this.variant);
			this.sourceColorHct = args.sourceColorHct;
			this.primaryPalette = args.primaryPalette ?? getSpec(this.specVersion).getPrimaryPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel);
			this.secondaryPalette = args.secondaryPalette ?? getSpec(this.specVersion).getSecondaryPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel);
			this.tertiaryPalette = args.tertiaryPalette ?? getSpec(this.specVersion).getTertiaryPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel);
			this.neutralPalette = args.neutralPalette ?? getSpec(this.specVersion).getNeutralPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel);
			this.neutralVariantPalette = args.neutralVariantPalette ?? getSpec(this.specVersion).getNeutralVariantPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel);
			this.errorPalette = args.errorPalette ?? getSpec(this.specVersion).getErrorPalette(this.variant, args.sourceColorHct, this.isDark, this.platform, this.contrastLevel) ?? TonalPalette.fromHueAndChroma(25, 84);
			this.colors = new MaterialDynamicColors();
		}
		toString() {
			return `Scheme: variant=${Variant[this.variant]}, mode=${this.isDark ? "dark" : "light"}, platform=${this.platform}, contrastLevel=${this.contrastLevel.toFixed(1)}, seed=${this.sourceColorHct.toString()}, specVersion=${this.specVersion}`;
		}
		static getPiecewiseHue(sourceColorHct, hueBreakpoints, hues) {
			const size = Math.min(hueBreakpoints.length - 1, hues.length);
			const sourceHue = sourceColorHct.hue;
			for (let i = 0; i < size; i++) if (sourceHue >= hueBreakpoints[i] && sourceHue < hueBreakpoints[i + 1]) return sanitizeDegreesDouble(hues[i]);
			return sourceHue;
		}
		static getRotatedHue(sourceColorHct, hueBreakpoints, rotations) {
			let rotation = DynamicScheme.getPiecewiseHue(sourceColorHct, hueBreakpoints, rotations);
			if (Math.min(hueBreakpoints.length - 1, rotations.length) <= 0) rotation = 0;
			return sanitizeDegreesDouble(sourceColorHct.hue + rotation);
		}
		getArgb(dynamicColor) {
			return dynamicColor.getArgb(this);
		}
		getHct(dynamicColor) {
			return dynamicColor.getHct(this);
		}
		get primaryPaletteKeyColor() {
			return this.getArgb(this.colors.primaryPaletteKeyColor());
		}
		get secondaryPaletteKeyColor() {
			return this.getArgb(this.colors.secondaryPaletteKeyColor());
		}
		get tertiaryPaletteKeyColor() {
			return this.getArgb(this.colors.tertiaryPaletteKeyColor());
		}
		get neutralPaletteKeyColor() {
			return this.getArgb(this.colors.neutralPaletteKeyColor());
		}
		get neutralVariantPaletteKeyColor() {
			return this.getArgb(this.colors.neutralVariantPaletteKeyColor());
		}
		get errorPaletteKeyColor() {
			return this.getArgb(this.colors.errorPaletteKeyColor());
		}
		get background() {
			return this.getArgb(this.colors.background());
		}
		get onBackground() {
			return this.getArgb(this.colors.onBackground());
		}
		get surface() {
			return this.getArgb(this.colors.surface());
		}
		get surfaceDim() {
			return this.getArgb(this.colors.surfaceDim());
		}
		get surfaceBright() {
			return this.getArgb(this.colors.surfaceBright());
		}
		get surfaceContainerLowest() {
			return this.getArgb(this.colors.surfaceContainerLowest());
		}
		get surfaceContainerLow() {
			return this.getArgb(this.colors.surfaceContainerLow());
		}
		get surfaceContainer() {
			return this.getArgb(this.colors.surfaceContainer());
		}
		get surfaceContainerHigh() {
			return this.getArgb(this.colors.surfaceContainerHigh());
		}
		get surfaceContainerHighest() {
			return this.getArgb(this.colors.surfaceContainerHighest());
		}
		get onSurface() {
			return this.getArgb(this.colors.onSurface());
		}
		get surfaceVariant() {
			return this.getArgb(this.colors.surfaceVariant());
		}
		get onSurfaceVariant() {
			return this.getArgb(this.colors.onSurfaceVariant());
		}
		get inverseSurface() {
			return this.getArgb(this.colors.inverseSurface());
		}
		get inverseOnSurface() {
			return this.getArgb(this.colors.inverseOnSurface());
		}
		get outline() {
			return this.getArgb(this.colors.outline());
		}
		get outlineVariant() {
			return this.getArgb(this.colors.outlineVariant());
		}
		get shadow() {
			return this.getArgb(this.colors.shadow());
		}
		get scrim() {
			return this.getArgb(this.colors.scrim());
		}
		get surfaceTint() {
			return this.getArgb(this.colors.surfaceTint());
		}
		get primary() {
			return this.getArgb(this.colors.primary());
		}
		get primaryDim() {
			const primaryDim = this.colors.primaryDim();
			if (primaryDim === void 0) throw new Error("`primaryDim` color is undefined prior to 2025 spec.");
			return this.getArgb(primaryDim);
		}
		get onPrimary() {
			return this.getArgb(this.colors.onPrimary());
		}
		get primaryContainer() {
			return this.getArgb(this.colors.primaryContainer());
		}
		get onPrimaryContainer() {
			return this.getArgb(this.colors.onPrimaryContainer());
		}
		get primaryFixed() {
			return this.getArgb(this.colors.primaryFixed());
		}
		get primaryFixedDim() {
			return this.getArgb(this.colors.primaryFixedDim());
		}
		get onPrimaryFixed() {
			return this.getArgb(this.colors.onPrimaryFixed());
		}
		get onPrimaryFixedVariant() {
			return this.getArgb(this.colors.onPrimaryFixedVariant());
		}
		get inversePrimary() {
			return this.getArgb(this.colors.inversePrimary());
		}
		get secondary() {
			return this.getArgb(this.colors.secondary());
		}
		get secondaryDim() {
			const secondaryDim = this.colors.secondaryDim();
			if (secondaryDim === void 0) throw new Error("`secondaryDim` color is undefined prior to 2025 spec.");
			return this.getArgb(secondaryDim);
		}
		get onSecondary() {
			return this.getArgb(this.colors.onSecondary());
		}
		get secondaryContainer() {
			return this.getArgb(this.colors.secondaryContainer());
		}
		get onSecondaryContainer() {
			return this.getArgb(this.colors.onSecondaryContainer());
		}
		get secondaryFixed() {
			return this.getArgb(this.colors.secondaryFixed());
		}
		get secondaryFixedDim() {
			return this.getArgb(this.colors.secondaryFixedDim());
		}
		get onSecondaryFixed() {
			return this.getArgb(this.colors.onSecondaryFixed());
		}
		get onSecondaryFixedVariant() {
			return this.getArgb(this.colors.onSecondaryFixedVariant());
		}
		get tertiary() {
			return this.getArgb(this.colors.tertiary());
		}
		get tertiaryDim() {
			const tertiaryDim = this.colors.tertiaryDim();
			if (tertiaryDim === void 0) throw new Error("`tertiaryDim` color is undefined prior to 2025 spec.");
			return this.getArgb(tertiaryDim);
		}
		get onTertiary() {
			return this.getArgb(this.colors.onTertiary());
		}
		get tertiaryContainer() {
			return this.getArgb(this.colors.tertiaryContainer());
		}
		get onTertiaryContainer() {
			return this.getArgb(this.colors.onTertiaryContainer());
		}
		get tertiaryFixed() {
			return this.getArgb(this.colors.tertiaryFixed());
		}
		get tertiaryFixedDim() {
			return this.getArgb(this.colors.tertiaryFixedDim());
		}
		get onTertiaryFixed() {
			return this.getArgb(this.colors.onTertiaryFixed());
		}
		get onTertiaryFixedVariant() {
			return this.getArgb(this.colors.onTertiaryFixedVariant());
		}
		get error() {
			return this.getArgb(this.colors.error());
		}
		get errorDim() {
			const errorDim = this.colors.errorDim();
			if (errorDim === void 0) throw new Error("`errorDim` color is undefined prior to 2025 spec.");
			return this.getArgb(errorDim);
		}
		get onError() {
			return this.getArgb(this.colors.onError());
		}
		get errorContainer() {
			return this.getArgb(this.colors.errorContainer());
		}
		get onErrorContainer() {
			return this.getArgb(this.colors.onErrorContainer());
		}
	};
	DynamicScheme.DEFAULT_SPEC_VERSION = "2021";
	DynamicScheme.DEFAULT_PLATFORM = "phone";
	var DynamicSchemePalettesDelegateImpl2021 = class {
		getPrimaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.CONTENT:
				case Variant.FIDELITY: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma);
				case Variant.FRUIT_SALAD: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue - 50), 48);
				case Variant.MONOCHROME: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 12);
				case Variant.RAINBOW: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 48);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue + 240), 40);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 200);
				default: throw new Error(`Unsupported variant: ${variant}`);
			}
		}
		getSecondaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.CONTENT:
				case Variant.FIDELITY: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, Math.max(sourceColorHct.chroma - 32, sourceColorHct.chroma * .5));
				case Variant.FRUIT_SALAD: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue - 50), 36);
				case Variant.MONOCHROME: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8);
				case Variant.RAINBOW: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					21,
					51,
					121,
					151,
					191,
					271,
					321,
					360
				], [
					45,
					95,
					45,
					20,
					45,
					90,
					45,
					45,
					45
				]), 24);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					41,
					61,
					101,
					131,
					181,
					251,
					301,
					360
				], [
					18,
					15,
					10,
					12,
					15,
					18,
					15,
					12,
					12
				]), 24);
				default: throw new Error(`Unsupported variant: ${variant}`);
			}
		}
		getTertiaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.CONTENT: return TonalPalette.fromHct(DislikeAnalyzer.fixIfDisliked(new TemperatureCache(sourceColorHct).analogous(3, 6)[2]));
				case Variant.FIDELITY: return TonalPalette.fromHct(DislikeAnalyzer.fixIfDisliked(new TemperatureCache(sourceColorHct).complement));
				case Variant.FRUIT_SALAD: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 36);
				case Variant.MONOCHROME: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
				case Variant.RAINBOW:
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue + 60), 24);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					21,
					51,
					121,
					151,
					191,
					271,
					321,
					360
				], [
					120,
					120,
					20,
					45,
					20,
					15,
					20,
					120,
					120
				]), 32);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					41,
					61,
					101,
					131,
					181,
					251,
					301,
					360
				], [
					35,
					30,
					20,
					25,
					30,
					35,
					30,
					25,
					25
				]), 32);
				default: throw new Error(`Unsupported variant: ${variant}`);
			}
		}
		getNeutralPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.CONTENT:
				case Variant.FIDELITY: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8);
				case Variant.FRUIT_SALAD: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 10);
				case Variant.MONOCHROME: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 2);
				case Variant.RAINBOW: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 6);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue + 15), 8);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 10);
				default: throw new Error(`Unsupported variant: ${variant}`);
			}
		}
		getNeutralVariantPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.CONTENT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8 + 4);
				case Variant.FIDELITY: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, sourceColorHct.chroma / 8 + 4);
				case Variant.FRUIT_SALAD: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
				case Variant.MONOCHROME: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 2);
				case Variant.RAINBOW: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 0);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 8);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(sanitizeDegreesDouble(sourceColorHct.hue + 15), 12);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 12);
				default: throw new Error(`Unsupported variant: ${variant}`);
			}
		}
		getErrorPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {}
	};
	var DynamicSchemePalettesDelegateImpl2025 = class DynamicSchemePalettesDelegateImpl2025 extends DynamicSchemePalettesDelegateImpl2021 {
		getPrimaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? Hct.isBlue(sourceColorHct.hue) ? 12 : 8 : Hct.isBlue(sourceColorHct.hue) ? 16 : 12);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" && isDark ? 26 : 32);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? isDark ? 36 : 48 : 40);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? 74 : 56);
				default: return super.getPrimaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
		getSecondaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? Hct.isBlue(sourceColorHct.hue) ? 6 : 4 : Hct.isBlue(sourceColorHct.hue) ? 10 : 6);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, 16);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					105,
					140,
					204,
					253,
					278,
					300,
					333,
					360
				], [
					-160,
					155,
					-100,
					96,
					-96,
					-156,
					-165,
					-160
				]), platform === "phone" ? isDark ? 16 : 24 : 24);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					38,
					105,
					140,
					333,
					360
				], [
					-14,
					10,
					-14,
					10,
					-14
				]), platform === "phone" ? 56 : 36);
				default: return super.getSecondaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
		getTertiaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					38,
					105,
					161,
					204,
					278,
					333,
					360
				], [
					-32,
					26,
					10,
					-39,
					24,
					-15,
					-32
				]), platform === "phone" ? 20 : 36);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					20,
					71,
					161,
					333,
					360
				], [
					-40,
					48,
					-32,
					40,
					-32
				]), platform === "phone" ? 28 : 32);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					105,
					140,
					204,
					253,
					278,
					300,
					333,
					360
				], [
					-165,
					160,
					-105,
					101,
					-101,
					-160,
					-170,
					-165
				]), 48);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(DynamicScheme.getRotatedHue(sourceColorHct, [
					0,
					38,
					71,
					105,
					140,
					161,
					253,
					333,
					360
				], [
					-72,
					35,
					24,
					-24,
					62,
					50,
					62,
					-72
				]), 56);
				default: return super.getTertiaryPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
		static getExpressiveNeutralHue(sourceColorHct) {
			return DynamicScheme.getRotatedHue(sourceColorHct, [
				0,
				71,
				124,
				253,
				278,
				300,
				360
			], [
				10,
				0,
				10,
				0,
				10,
				0
			]);
		}
		static getExpressiveNeutralChroma(sourceColorHct, isDark, platform) {
			const neutralHue = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct);
			return platform === "phone" ? isDark ? Hct.isYellow(neutralHue) ? 6 : 14 : 18 : 12;
		}
		static getVibrantNeutralHue(sourceColorHct) {
			return DynamicScheme.getRotatedHue(sourceColorHct, [
				0,
				38,
				105,
				140,
				333,
				360
			], [
				-14,
				10,
				-14,
				10,
				-14
			]);
		}
		static getVibrantNeutralChroma(sourceColorHct, platform) {
			const neutralHue = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct);
			return platform === "phone" ? 28 : Hct.isBlue(neutralHue) ? 28 : 20;
		}
		getNeutralPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? 1.4 : 6);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, platform === "phone" ? 5 : 10);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct), DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralChroma(sourceColorHct, isDark, platform));
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct), DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralChroma(sourceColorHct, platform));
				default: return super.getNeutralPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
		getNeutralVariantPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, (platform === "phone" ? 1.4 : 6) * 2.2);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(sourceColorHct.hue, (platform === "phone" ? 5 : 10) * 1.7);
				case Variant.EXPRESSIVE:
					const expressiveNeutralHue = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralHue(sourceColorHct);
					const expressiveNeutralChroma = DynamicSchemePalettesDelegateImpl2025.getExpressiveNeutralChroma(sourceColorHct, isDark, platform);
					return TonalPalette.fromHueAndChroma(expressiveNeutralHue, expressiveNeutralChroma * (expressiveNeutralHue >= 105 && expressiveNeutralHue < 125 ? 1.6 : 2.3));
				case Variant.VIBRANT:
					const vibrantNeutralHue = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralHue(sourceColorHct);
					const vibrantNeutralChroma = DynamicSchemePalettesDelegateImpl2025.getVibrantNeutralChroma(sourceColorHct, platform);
					return TonalPalette.fromHueAndChroma(vibrantNeutralHue, vibrantNeutralChroma * 1.29);
				default: return super.getNeutralVariantPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
		getErrorPalette(variant, sourceColorHct, isDark, platform, contrastLevel) {
			const errorHue = DynamicScheme.getPiecewiseHue(sourceColorHct, [
				0,
				3,
				13,
				23,
				33,
				43,
				153,
				273,
				360
			], [
				12,
				22,
				32,
				12,
				22,
				32,
				22,
				12
			]);
			switch (variant) {
				case Variant.NEUTRAL: return TonalPalette.fromHueAndChroma(errorHue, platform === "phone" ? 50 : 40);
				case Variant.TONAL_SPOT: return TonalPalette.fromHueAndChroma(errorHue, platform === "phone" ? 60 : 48);
				case Variant.EXPRESSIVE: return TonalPalette.fromHueAndChroma(errorHue, platform === "phone" ? 64 : 48);
				case Variant.VIBRANT: return TonalPalette.fromHueAndChroma(errorHue, platform === "phone" ? 80 : 60);
				default: return super.getErrorPalette(variant, sourceColorHct, isDark, platform, contrastLevel);
			}
		}
	};
	var spec2021 = new DynamicSchemePalettesDelegateImpl2021();
	var spec2025 = new DynamicSchemePalettesDelegateImpl2025();
	function getSpec(specVersion) {
		return specVersion === "2025" ? spec2025 : spec2021;
	}
	var SchemeTonalSpot = class extends DynamicScheme {
		constructor(sourceColorHct, isDark, contrastLevel, specVersion = DynamicScheme.DEFAULT_SPEC_VERSION, platform = DynamicScheme.DEFAULT_PLATFORM) {
			super({
				sourceColorHct,
				variant: Variant.TONAL_SPOT,
				contrastLevel,
				isDark,
				platform,
				specVersion
			});
		}
	};
	var SCORE_OPTION_DEFAULTS = {
		desired: 4,
		fallbackColorARGB: 4282549748,
		filter: true
	};
	function compare(a, b) {
		if (a.score > b.score) return -1;
		else if (a.score < b.score) return 1;
		return 0;
	}
	var Score = class Score {
		constructor() {}
		static score(colorsToPopulation, options) {
			const { desired, fallbackColorARGB, filter } = {
				...SCORE_OPTION_DEFAULTS,
				...options
			};
			const colorsHct = [];
			const huePopulation = new Array(360).fill(0);
			let populationSum = 0;
			for (const [argb, population] of colorsToPopulation.entries()) {
				const hct = Hct.fromInt(argb);
				colorsHct.push(hct);
				const hue = Math.floor(hct.hue);
				huePopulation[hue] += population;
				populationSum += population;
			}
			const hueExcitedProportions = new Array(360).fill(0);
			for (let hue = 0; hue < 360; hue++) {
				const proportion = huePopulation[hue] / populationSum;
				for (let i = hue - 14; i < hue + 16; i++) {
					const neighborHue = sanitizeDegreesInt(i);
					hueExcitedProportions[neighborHue] += proportion;
				}
			}
			const scoredHct = new Array();
			for (const hct of colorsHct) {
				const proportion = hueExcitedProportions[sanitizeDegreesInt(Math.round(hct.hue))];
				if (filter && (hct.chroma < Score.CUTOFF_CHROMA || proportion <= Score.CUTOFF_EXCITED_PROPORTION)) continue;
				const proportionScore = proportion * 100 * Score.WEIGHT_PROPORTION;
				const chromaWeight = hct.chroma < Score.TARGET_CHROMA ? Score.WEIGHT_CHROMA_BELOW : Score.WEIGHT_CHROMA_ABOVE;
				const score = proportionScore + (hct.chroma - Score.TARGET_CHROMA) * chromaWeight;
				scoredHct.push({
					hct,
					score
				});
			}
			scoredHct.sort(compare);
			const chosenColors = [];
			for (let differenceDegrees$1 = 90; differenceDegrees$1 >= 15; differenceDegrees$1--) {
				chosenColors.length = 0;
				for (const { hct } of scoredHct) {
					if (!chosenColors.find((chosenHct) => {
						return differenceDegrees(hct.hue, chosenHct.hue) < differenceDegrees$1;
					})) chosenColors.push(hct);
					if (chosenColors.length >= desired) break;
				}
				if (chosenColors.length >= desired) break;
			}
			const colors = [];
			if (chosenColors.length === 0) colors.push(fallbackColorARGB);
			for (const chosenHct of chosenColors) colors.push(chosenHct.toInt());
			return colors;
		}
	};
	Score.TARGET_CHROMA = 48;
	Score.WEIGHT_PROPORTION = .7;
	Score.WEIGHT_CHROMA_ABOVE = .3;
	Score.WEIGHT_CHROMA_BELOW = .1;
	Score.CUTOFF_CHROMA = 5;
	Score.CUTOFF_EXCITED_PROPORTION = .01;
	function hexFromArgb(argb) {
		const r = redFromArgb(argb);
		const g = greenFromArgb(argb);
		const b = blueFromArgb(argb);
		const outParts = [
			r.toString(16),
			g.toString(16),
			b.toString(16)
		];
		for (const [i, part] of outParts.entries()) if (part.length === 1) outParts[i] = "0" + part;
		return "#" + outParts.join("");
	}
	function argbFromHex(hex) {
		hex = hex.replace("#", "");
		const isThree = hex.length === 3;
		const isSix = hex.length === 6;
		const isEight = hex.length === 8;
		if (!isThree && !isSix && !isEight) throw new Error("unexpected hex " + hex);
		let r = 0;
		let g = 0;
		let b = 0;
		if (isThree) {
			r = parseIntHex(hex.slice(0, 1).repeat(2));
			g = parseIntHex(hex.slice(1, 2).repeat(2));
			b = parseIntHex(hex.slice(2, 3).repeat(2));
		} else if (isSix) {
			r = parseIntHex(hex.slice(0, 2));
			g = parseIntHex(hex.slice(2, 4));
			b = parseIntHex(hex.slice(4, 6));
		} else if (isEight) {
			r = parseIntHex(hex.slice(2, 4));
			g = parseIntHex(hex.slice(4, 6));
			b = parseIntHex(hex.slice(6, 8));
		}
		return (255 << 24 | (r & 255) << 16 | (g & 255) << 8 | b & 255) >>> 0;
	}
	function parseIntHex(value) {
		return parseInt(value, 16);
	}
	var kebab = (s) => s.replace(/_/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
	var CUSTOM = {
		success: "#1E8E3E",
		warning: "#E37400",
		info: "#1A73E8"
	};
	function schemeVars(seed, dark, contrast) {
		const scheme = new SchemeTonalSpot(Hct.fromInt(seed), dark, contrast);
		const out = [];
		for (const c of new MaterialDynamicColors().allColors) out.push(`--md-sys-color-${kebab(c.name)}: ${hexFromArgb(c.getArgb(scheme))};`);
		for (const [name, hex] of Object.entries(CUSTOM)) {
			const palette = TonalPalette.fromInt(Blend.harmonize(argbFromHex(hex), seed));
			const t = dark ? {
				base: 80,
				on: 20,
				container: 30,
				onContainer: 90
			} : {
				base: 40,
				on: 100,
				container: 90,
				onContainer: 10
			};
			out.push(`--mc-${name}: ${hexFromArgb(palette.tone(t.base))};`, `--mc-on-${name}: ${hexFromArgb(palette.tone(t.on))};`, `--mc-${name}-container: ${hexFromArgb(palette.tone(t.container))};`, `--mc-on-${name}-container: ${hexFromArgb(palette.tone(t.onContainer))};`);
		}
		return out;
	}
	function buildThemeCss(seedHex, contrast) {
		let seed;
		try {
			seed = argbFromHex(seedHex);
		} catch {
			seed = argbFromHex("#C8161E");
		}
		return `html[data-mc-theme="light"] {\n  color-scheme: light;\n  ${schemeVars(seed, false, contrast).join("\n  ")}\n}\nhtml[data-mc-theme="dark"] {\n  color-scheme: dark;\n  ${schemeVars(seed, true, contrast).join("\n  ")}\n}\n`;
	}
	var V = (name) => `var(--md-sys-color-${name})`;
	var C = (name) => `var(--mc-${name})`;
	var COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;
	function parseColor(s) {
		s = s.trim().toLowerCase();
		if (s === "white") return {
			r: 255,
			g: 255,
			b: 255,
			a: 1
		};
		if (s === "black") return {
			r: 0,
			g: 0,
			b: 0,
			a: 1
		};
		if (s[0] === "#") {
			let h = s.slice(1);
			if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
			if (h.length !== 6 && h.length !== 8) return null;
			const n = parseInt(h, 16);
			if (Number.isNaN(n)) return null;
			return h.length === 6 ? {
				r: n >> 16 & 255,
				g: n >> 8 & 255,
				b: n & 255,
				a: 1
			} : {
				r: n >>> 24 & 255,
				g: n >> 16 & 255,
				b: n >> 8 & 255,
				a: (n & 255) / 255
			};
		}
		const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
		if (!m) return null;
		let a = m[4] === void 0 ? 1 : parseFloat(m[4]);
		if (m[4]?.endsWith("%")) a /= 100;
		return {
			r: +m[1],
			g: +m[2],
			b: +m[3],
			a
		};
	}
	function family(hue) {
		if (hue < 40 || hue >= 345) return "error";
		if (hue < 105) return "warning";
		if (hue < 165) return "success";
		if (hue < 290) return "primary";
		return "tertiary";
	}
	function familyRole(f, kind, tone) {
		const md = f === "primary" || f === "error" || f === "tertiary";
		const base = md ? V(f) : C(f);
		const container = md ? V(`${f}-container`) : C(`${f}-container`);
		const onContainer = md ? V(`on-${f}-container`) : C(`on-${f}-container`);
		if (kind === "bg") return tone >= 82 ? container : base;
		if (kind === "bd") return tone >= 82 ? container : base;
		return tone >= 82 ? onContainer : base;
	}
	function neutralRole(kind, tone) {
		if (kind === "bg") {
			if (tone >= 98.5) return V("surface");
			if (tone >= 94) return V("surface-container");
			if (tone >= 89) return V("surface-container-high");
			if (tone >= 75) return V("surface-container-highest");
			if (tone >= 45) return V("outline");
			return V("inverse-surface");
		}
		if (kind === "fg") {
			if (tone >= 92) return V("on-primary");
			if (tone >= 66) return V("outline");
			if (tone >= 40) return V("on-surface-variant");
			return V("on-surface");
		}
		if (tone >= 97) return V("surface");
		if (tone >= 70) return V("outline-variant");
		return V("outline");
	}
	var memo = new Map();
	function mapColor(raw, kind) {
		const key = kind + raw;
		const hit = memo.get(key);
		if (hit !== void 0) return hit;
		const c = parseColor(raw);
		let out = null;
		if (c && c.a > 0) {
			const isBlackAlpha = c.a < 1 && c.r < 60 && c.g < 60 && c.b < 70;
			const isWhiteAlpha = c.a < 1 && c.r > 230 && c.g > 230 && c.b > 230;
			if (isBlackAlpha) {
				if (kind !== "bg" || c.a < .3) out = mix(V("on-surface"), c.a);
			} else if (isWhiteAlpha) out = kind === "bg" && c.a >= .5 ? mix(V("surface"), c.a) : null;
			else {
				const hct = Hct.fromInt((255 << 24 | c.r << 16 | c.g << 8 | c.b) >>> 0);
				const role = hct.chroma < 14 ? neutralRole(kind, hct.tone) : familyRole(family(hct.hue), kind, hct.tone);
				out = c.a < 1 ? mix(role, c.a) : role;
			}
		}
		memo.set(key, out);
		return out;
	}
	var mix = (role, a) => `color-mix(in srgb, ${role} ${Math.round(a * 1e3) / 10}%, transparent)`;
	function kindOfProp(prop) {
		if (prop.startsWith("--")) {
			const name = prop.replace(/^--[a-zA-Z]{5}-/, "");
			if (/shadow/i.test(name)) return "shadow";
			if (/background|bg|track|fill(?!ed)|facade|checked(?!.*Label)/i.test(name)) return "bg";
			if (/border|outline|focus|ring|stroke/i.test(name)) return "bd";
			if (/color/i.test(name)) return "fg";
			return "fg";
		}
		if (prop.startsWith("background") || prop === "fill") return "bg";
		if (prop.startsWith("border") || prop.startsWith("outline") || prop === "column-rule-color") return "bd";
		if (prop === "box-shadow" || prop === "text-shadow") return "shadow";
		if (prop === "color" || prop === "caret-color" || prop === "text-decoration-color" || prop === "stroke") return "fg";
		return null;
	}
	var FONT_RE = /LatoWeb|"Lato Extended"|Lato\b/;
	function mapRadius(v) {
		const m = v.trim().match(/^([\d.]+)rem$/);
		if (!m) return null;
		const n = parseFloat(m[1]);
		if (n === 0 || n >= 100) return null;
		if (n <= .125) return "0.25rem";
		if (n <= .25) return "var(--mc-shape-sm)";
		return "var(--mc-shape-md)";
	}
	function rewrite(prop, value) {
		if (!value || value.includes("var(--md-") || value.includes("var(--mc-")) return null;
		if (prop === "font-family" || /^--[a-zA-Z]{5}-.*[fF]ontFamily$/.test(prop)) return FONT_RE.test(value) && !/monospace/.test(value) ? "var(--mc-font)" : null;
		if (/^--[a-zA-Z]{5}-.*[rR]adius$/.test(prop)) return mapRadius(value);
		const kind = kindOfProp(prop);
		if (!kind) return null;
		if (kind === "shadow") return null;
		let changed = false;
		const out = value.replace(COLOR_RE, (m) => {
			const r = mapColor(m, kind);
			if (r) changed = true;
			return r ?? m;
		});
		return changed ? out : null;
	}
	var SKIP_SELECTOR = /group_(course|user|group|appointment)_|\.fc-event|ic-DashboardCard__header_hero|\.mc-|#mc-/;
	function processRules(rules, out) {
		for (const rule of Array.from(rules)) if (rule instanceof CSSStyleRule) {
			if (SKIP_SELECTOR.test(rule.selectorText)) continue;
			const decls = [];
			const st = rule.style;
			for (let i = 0; i < st.length; i++) {
				const prop = st[i];
				const nv = rewrite(prop, st.getPropertyValue(prop));
				if (nv !== null) decls.push(`${prop}:${nv}${st.getPropertyPriority(prop) ? " !important" : ""}`);
			}
			if (decls.length) out.push(`${rule.selectorText}{${decls.join(";")}}`);
		} else if (rule instanceof CSSMediaRule) {
			const inner = [];
			processRules(rule.cssRules, inner);
			if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join("\n")}}`);
		} else if (rule instanceof CSSSupportsRule) {
			const inner = [];
			processRules(rule.cssRules, inner);
			if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join("\n")}}`);
		}
	}
	function recolorSheet(sheet) {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			return null;
		}
		const out = [];
		processRules(rules, out);
		return out.join("\n");
	}
	function recolorInline(style) {
		for (const prop of [
			"color",
			"background-color",
			"background",
			"border-color"
		]) {
			const v = style.getPropertyValue(prop);
			if (!v) continue;
			const kind = kindOfProp(prop);
			const nv = v.replace(COLOR_RE, (m) => mapColor(m, kind) ?? m);
			if (nv !== v) style.setProperty(prop, nv);
		}
	}
	var INDEX_KEY = "rcIndex";
	var ENTRY_PREFIX = "rc:";
	var CACHE_VERSION = 5;
	var CACHE_LIMIT = 40;
	var index = {
		v: CACHE_VERSION,
		t: {},
		lastHrefs: []
	};
	var loaded = new Map();
	var dirtyEntries = new Set();
	var indexDirty = false;
	function loadIndex() {
		const i = _GM_getValue(INDEX_KEY, null);
		if (i && i.v === CACHE_VERSION) index = i;
		else {
			if (i) for (const href of Object.keys(i.t ?? {})) _GM_deleteValue(ENTRY_PREFIX + href);
			_GM_deleteValue("recolorCache");
		}
	}
	function getEntry(href) {
		if (loaded.has(href)) return loaded.get(href);
		if (!(href in index.t)) return null;
		const css = _GM_getValue(ENTRY_PREFIX + href, null);
		if (css === null) {
			delete index.t[href];
			indexDirty = true;
			return null;
		}
		loaded.set(href, css);
		return css;
	}
	function putEntry(href, css) {
		loaded.set(href, css);
		index.t[href] = Date.now();
		dirtyEntries.add(href);
		indexDirty = true;
	}
	function touch(href) {
		index.t[href] = Date.now();
	}
	function flushCache() {
		for (const href of dirtyEntries) _GM_setValue(ENTRY_PREFIX + href, loaded.get(href));
		dirtyEntries.clear();
		const keys = Object.keys(index.t);
		if (keys.length > CACHE_LIMIT) {
			keys.sort((a, b) => index.t[a] - index.t[b]).slice(0, keys.length - CACHE_LIMIT).forEach((k) => {
				delete index.t[k];
				_GM_deleteValue(ENTRY_PREFIX + k);
			});
			indexDirty = true;
		}
		if (indexDirty) _GM_setValue(INDEX_KEY, index);
		indexDirty = false;
	}
	var root = () => document.head ?? document.documentElement;
	var MARK = "data-mc";
	function makeStyle(id) {
		const el = document.createElement("style");
		el.setAttribute(MARK, id);
		return el;
	}
	var fixed = [];
	var outputs = new Map();
	var seen = new WeakMap();
	var enabled = true;
	function addFixedStyle(id, css) {
		const el = makeStyle(id);
		el.textContent = css;
		fixed.push(el);
		root().appendChild(el);
		return el;
	}
	function isOurs(node) {
		return !!node && node instanceof Element && node.hasAttribute(MARK);
	}
	function ensureOrder() {
		const parent = root();
		const last = parent.lastElementChild;
		const ours = [...outputs.values(), ...fixed];
		let needs = false;
		const first = ours.find((e) => e.parentNode);
		if (!first || first.parentNode !== parent) needs = true;
		else for (let n = first.nextElementSibling; n; n = n.nextElementSibling) if (!isOurs(n) && (n.tagName === "STYLE" || n.tagName === "LINK" && n.rel === "stylesheet")) {
			needs = true;
			break;
		}
		if (!needs && last && isOurs(last)) return;
		if (!needs) return;
		for (const el of ours) parent.appendChild(el);
	}
	function sheetKey(sheet, index) {
		return sheet.href ?? `inline:${index}`;
	}
	function setOutput(key, css) {
		let el = outputs.get(key);
		if (!el) {
			el = makeStyle(`recolor ${key.slice(-60)}`);
			outputs.set(key, el);
		}
		if (el.textContent !== css) el.textContent = css;
		if (!el.isConnected && enabled) {
			const before = fixed.find((f) => f.isConnected) ?? null;
			root().insertBefore(el, before && before.parentNode === root() ? before : null);
		}
	}
	function scan() {
		if (!enabled) return;
		const sheets = Array.from(document.styleSheets);
		let inlineIdx = 0;
		const hrefs = [];
		for (const sheet of sheets) {
			const owner = sheet.ownerNode;
			if (isOurs(owner)) continue;
			if (sheet.disabled) continue;
			const key = sheet.href ? sheetKey(sheet, 0) : sheetKey(sheet, inlineIdx++);
			if (sheet.href) {
				if (!sheet.href.startsWith(location.origin)) continue;
				hrefs.push(sheet.href);
			}
			let count;
			try {
				count = sheet.cssRules.length;
			} catch {
				continue;
			}
			if (seen.get(sheet) === count) continue;
			seen.set(sheet, count);
			const cached = sheet.href ? getEntry(sheet.href) : null;
			if (sheet.href && cached !== null) {
				touch(sheet.href);
				setOutput(key, cached);
				continue;
			}
			const css = recolorSheet(sheet);
			if (css === null) continue;
			setOutput(key, css);
			if (sheet.href) putEntry(sheet.href, css);
		}
		if (hrefs.length && hrefs.join() !== index.lastHrefs.join()) {
			index.lastHrefs = hrefs;
			indexDirty = true;
		}
		ensureOrder();
	}
	var scheduled = false;
	function scheduleScan() {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			scan();
		});
	}
	function primeFromCache() {
		loadIndex();
		for (const href of index.lastHrefs) {
			const css = getEntry(href);
			if (css !== null) setOutput(href, css);
		}
	}
	function startObserving() {
		new MutationObserver((records) => {
			for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof HTMLLinkElement && n.rel === "stylesheet") n.addEventListener("load", scheduleScan, { once: true });
			scheduleScan();
		}).observe(document.documentElement, {
			childList: true,
			subtree: true
		});
		document.addEventListener("DOMContentLoaded", scheduleScan);
		window.addEventListener("load", () => {
			scan();
			flushCache();
		});
		setTimeout(flushCache, 8e3);
	}
	function setEnabled(on) {
		enabled = on;
		for (const el of [...outputs.values(), ...fixed]) {
			if (on && !el.isConnected) root().appendChild(el);
			if (!on) el.remove();
		}
		if (on) scan();
	}
	var panel_default = ":host{all:initial;font-family:var(--mc-font,system-ui, sans-serif);color:var(--md-sys-color-on-surface)}*{box-sizing:border-box}.scrim{z-index:2147483000;background:color-mix(in srgb, var(--md-sys-color-scrim) 32%, transparent);justify-content:center;align-items:center;padding:16px;animation:.2s cubic-bezier(.2,0,0,1) fade;display:flex;position:fixed;inset:0}.dialog{background:var(--md-sys-color-surface-container-high);width:min(520px,100%);max-height:calc(100vh - 32px);color:var(--md-sys-color-on-surface);border-radius:28px;padding:24px;animation:.25s cubic-bezier(.05,.7,.1,1) rise;overflow:auto;box-shadow:0 1px 3px #0000004d,0 4px 8px 3px #00000026}@keyframes fade{0%{opacity:0}}@keyframes rise{0%{opacity:0;transform:translateY(24px)scale(.98)}}h2{margin:0 0 4px;font-size:24px;font-weight:400;line-height:32px}.sub{color:var(--md-sys-color-on-surface-variant);margin:0 0 20px;font-size:14px;line-height:20px}.section{margin-bottom:24px}.label{letter-spacing:.01em;color:var(--md-sys-color-on-surface-variant);margin-bottom:12px;font-size:14px;font-weight:500}.swatches{grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:12px;display:grid}.swatch{font:inherit;color:var(--md-sys-color-on-surface-variant);cursor:pointer;background:0 0;border:none;flex-direction:column;align-items:center;gap:6px;padding:0;font-size:11px;display:flex;position:relative}.swatch .dot{outline-offset:3px;border-radius:50%;outline:2px solid #0000;place-items:center;width:44px;height:44px;transition:outline-color .2s,transform .2s cubic-bezier(.2,0,0,1);display:grid}.swatch:hover .dot{transform:scale(1.06)}.swatch[aria-pressed=true] .dot{outline-color:var(--md-sys-color-primary)}.swatch[aria-pressed=true] .dot:after{content:\"\";border-top:none;border-bottom:3px solid #fff;border-left:3px solid #fff;border-right:none;width:14px;height:8px;transform:translateY(-2px)rotate(-45deg)}.swatch input[type=color]{opacity:0;cursor:pointer;width:44px;height:44px;margin:0 auto;position:absolute;inset:0}.swatch.custom .dot{background:conic-gradient(#f44,#fd4,#4d4,#4dd,#44f,#d4d,#f44)}.segmented{border:1px solid var(--md-sys-color-outline);border-radius:999px;display:flex;overflow:hidden}.segmented button{height:40px;font:inherit;color:var(--md-sys-color-on-surface);border:none;border-left:1px solid var(--md-sys-color-outline);cursor:pointer;background:0 0;flex:1;justify-content:center;align-items:center;gap:6px;font-size:14px;font-weight:500;transition:background-color .2s;display:flex}.segmented button:first-child{border-left:none}.segmented button:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent)}.segmented button[aria-pressed=true]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}.segmented button[aria-pressed=true]:before{content:\"✓\";font-size:14px}.row{justify-content:space-between;align-items:center;gap:16px;padding:8px 0;display:flex}.row .text{font-size:16px;line-height:24px}.row .text small{color:var(--md-sys-color-on-surface-variant);font-size:14px;line-height:20px;display:block}.switch{border:2px solid var(--md-sys-color-outline);background:var(--md-sys-color-surface-container-highest);cursor:pointer;border-radius:999px;flex:none;width:52px;height:32px;padding:0;transition:background-color .2s,border-color .2s;position:relative}.switch:after{content:\"\";background:var(--md-sys-color-outline);border-radius:50%;width:16px;height:16px;transition:all .25s cubic-bezier(.2,0,0,1);position:absolute;top:50%;left:6px;transform:translateY(-50%)}.switch[aria-checked=true]{background:var(--md-sys-color-primary);border-color:var(--md-sys-color-primary)}.switch[aria-checked=true]:after{background:var(--md-sys-color-on-primary);width:24px;height:24px;left:22px}.actions{justify-content:flex-end;gap:8px;margin-top:8px;display:flex}.btn{height:40px;font:inherit;cursor:pointer;color:var(--md-sys-color-primary);background:0 0;border:none;border-radius:999px;padding:0 24px;font-size:14px;font-weight:500;transition:background-color .2s,box-shadow .2s}.btn:hover{background:color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent)}.btn.filled{background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}.btn.filled:hover{background:color-mix(in srgb, var(--md-sys-color-primary), var(--md-sys-color-on-primary) 8%);box-shadow:0 1px 2px #0000004d,0 1px 3px 1px #00000026}button:focus-visible{outline:3px solid var(--md-sys-color-secondary);outline-offset:2px}.preview{gap:6px;margin-top:12px;display:flex}.preview span{border-radius:6px;flex:1;height:24px}";
	var host = null;
	function h(tag, attrs = {}, ...children) {
		const el = document.createElement(tag);
		for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
		el.append(...children);
		return el;
	}
	function openPanel(current, apply) {
		if (host) return;
		let s = { ...current };
		const update = (patch) => {
			s = {
				...s,
				...patch
			};
			apply(s);
			render();
		};
		host = h("div", { id: "mc-settings-host" });
		const shadow = host.attachShadow({ mode: "open" });
		const style = h("style");
		style.textContent = panel_default;
		const body = h("div");
		shadow.append(style, body);
		document.body.appendChild(host);
		const close = () => {
			host?.remove();
			host = null;
			document.removeEventListener("keydown", onKey, true);
		};
		const onKey = (e) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				close();
			}
		};
		document.addEventListener("keydown", onKey, true);
		const scrim = h("div", { class: "scrim" });
		scrim.addEventListener("click", (e) => e.target === scrim && close());
		const dialog = h("div", {
			class: "dialog",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "mc-title"
		});
		scrim.append(dialog);
		body.append(scrim);
		function render() {
			const focusKey = shadow.activeElement?.textContent ?? null;
			dialog.replaceChildren();
			dialog.append(h("h2", { id: "mc-title" }, "Materialized Canvas"), h("p", { class: "sub" }, "Material Design 3 外观设置，修改即时生效并自动保存。"));
			const swatches = h("div", {
				class: "swatches",
				role: "group",
				"aria-label": "主色"
			});
			const isPreset = PRESETS.some((p) => p.color.toLowerCase() === s.seed.toLowerCase());
			for (const p of PRESETS) {
				const pressed = p.color.toLowerCase() === s.seed.toLowerCase();
				const b = h("button", {
					class: "swatch",
					type: "button",
					"aria-pressed": String(pressed),
					title: p.color
				}, h("span", {
					class: "dot",
					style: `background:${p.color}`
				}), p.name);
				b.addEventListener("click", () => update({ seed: p.color }));
				swatches.append(b);
			}
			const picker = h("input", {
				type: "color",
				value: s.seed,
				"aria-label": "自定义颜色"
			});
			let pickTimer = 0;
			picker.addEventListener("input", () => {
				clearTimeout(pickTimer);
				pickTimer = window.setTimeout(() => {
					s = {
						...s,
						seed: picker.value
					};
					apply(s);
				}, 60);
			});
			picker.addEventListener("change", () => update({ seed: picker.value }));
			const custom = h("label", {
				class: "swatch custom",
				"aria-pressed": String(!isPreset)
			}, h("span", {
				class: "dot",
				style: isPreset ? "" : `background:${s.seed}`
			}), "自定义", picker);
			swatches.append(custom);
			const preview = h("div", {
				class: "preview",
				"aria-hidden": "true"
			}, ...[
				"primary",
				"secondary",
				"tertiary",
				"primary-container",
				"secondary-container",
				"surface-container-highest"
			].map((r) => h("span", {
				style: `background:var(--md-sys-color-${r})`,
				title: r
			})));
			dialog.append(h("div", { class: "section" }, h("div", { class: "label" }, "主色"), swatches, preview));
			const modes = [
				{
					v: "light",
					label: "浅色"
				},
				{
					v: "dark",
					label: "深色"
				},
				{
					v: "system",
					label: "跟随系统"
				}
			];
			const seg = h("div", {
				class: "segmented",
				role: "group",
				"aria-label": "外观模式"
			});
			for (const m of modes) {
				const b = h("button", {
					type: "button",
					"aria-pressed": String(s.mode === m.v)
				}, m.label);
				b.addEventListener("click", () => update({ mode: m.v }));
				seg.append(b);
			}
			dialog.append(h("div", { class: "section" }, h("div", { class: "label" }, "外观模式"), seg));
			const contrasts = [
				{
					v: 0,
					label: "标准"
				},
				{
					v: .5,
					label: "中"
				},
				{
					v: 1,
					label: "高"
				}
			];
			const cseg = h("div", {
				class: "segmented",
				role: "group",
				"aria-label": "对比度"
			});
			for (const c of contrasts) {
				const b = h("button", {
					type: "button",
					"aria-pressed": String(s.contrast === c.v)
				}, c.label);
				b.addEventListener("click", () => update({ contrast: c.v }));
				cseg.append(b);
			}
			dialog.append(h("div", { class: "section" }, h("div", { class: "label" }, "对比度"), cseg));
			const sw = (key, title, desc) => {
				const b = h("button", {
					class: "switch",
					type: "button",
					role: "switch",
					"aria-checked": String(s[key]),
					"aria-label": title
				});
				b.addEventListener("click", () => update({ [key]: !s[key] }));
				return h("div", { class: "row" }, h("div", { class: "text" }, title, h("small", {}, desc)), b);
			};
			dialog.append(h("div", { class: "section" }, sw("enabled", "启用美化", "关闭后恢复 Canvas 原始外观"), sw("darkUserContent", "深色模式下重新着色正文", "调整课程页面、公告中老师设置的文字/背景颜色")));
			const reset = h("button", {
				class: "btn",
				type: "button"
			}, "恢复默认");
			reset.addEventListener("click", () => update({ ...DEFAULTS }));
			const done = h("button", {
				class: "btn filled",
				type: "button"
			}, "完成");
			done.addEventListener("click", close);
			dialog.append(h("div", { class: "actions" }, reset, done));
			(focusKey ? [...dialog.querySelectorAll("button, label")].find((b) => b.textContent === focusKey) : dialog.querySelector("[aria-pressed=\"true\"]"))?.focus({ preventScroll: true });
		}
		render();
	}
	var ORIG = "data-mc-orig-style";
	var SCOPE = ".user_content, .show-content, #course_syllabus, .discussion-section .message, [data-resource-type=\"wiki_page.body\"]";
	var active = false;
	var recolorUC = true;
	var mo = null;
	function recolorTree(root) {
		const els = root.querySelectorAll(`:is(${SCOPE}) [style*="color"], :is(${SCOPE}) [style*="background"], :is(${SCOPE}) [style*="border"], :is(${SCOPE}) font[color], :is(${SCOPE}) [bgcolor]`);
		for (const el of els) {
			if (el.closest("#mc-settings-host")) continue;
			if (!el.hasAttribute(ORIG)) el.setAttribute(ORIG, el.getAttribute("style") ?? "");
			if (el.tagName === "FONT" && el.getAttribute("color")) el.style.color = el.getAttribute("color");
			const bg = el.getAttribute("bgcolor");
			if (bg) el.style.backgroundColor = bg;
			recolorInline(el.style);
		}
	}
	function restoreTree() {
		for (const el of document.querySelectorAll(`[${ORIG}]`)) {
			const orig = el.getAttribute(ORIG);
			if (orig) el.setAttribute("style", orig);
			else el.removeAttribute("style");
			el.removeAttribute(ORIG);
		}
	}
	var EDITOR_CSS = `
html, body { background: var(--md-sys-color-surface-container-lowest) !important; color: var(--md-sys-color-on-surface) !important; color-scheme: dark; }
a { color: var(--md-sys-color-primary) !important; }
table, td, th { border-color: var(--md-sys-color-outline-variant) !important; }
`;
	function themeIframe(iframe, vars) {
		let doc = null;
		try {
			doc = iframe.contentDocument;
		} catch {
			return;
		}
		if (!doc || !doc.head) return;
		if (doc.location.href !== "about:blank" && !doc.location.href.startsWith(location.origin)) return;
		let el = doc.getElementById("mc-editor-theme");
		if (!active) {
			el?.remove();
			return;
		}
		if (!el) {
			el = doc.createElement("style");
			el.id = "mc-editor-theme";
			doc.head.appendChild(el);
		}
		el.textContent = `:root{${vars}}\n${EDITOR_CSS}`;
	}
	function currentVars() {
		const cs = getComputedStyle(document.documentElement);
		return [
			"surface-container-lowest",
			"on-surface",
			"primary",
			"outline-variant"
		].map((n) => `--md-sys-color-${n}:${cs.getPropertyValue(`--md-sys-color-${n}`)};`).join("");
	}
	function themeEditors() {
		const vars = currentVars();
		for (const f of document.querySelectorAll(".tox-edit-area__iframe, iframe[id$=\"_ifr\"]")) {
			themeIframe(f, vars);
			f.addEventListener("load", () => themeIframe(f, currentVars()), { once: true });
		}
	}
	var pending = false;
	function schedule() {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			if (!active) return;
			if (recolorUC) recolorTree(document);
			themeEditors();
		});
	}
	function setDarkContent(on, recolorUserContent) {
		const was = active;
		active = on;
		recolorUC = recolorUserContent;
		if (!document.body) {
			document.addEventListener("DOMContentLoaded", () => setDarkContent(on, recolorUserContent), { once: true });
			return;
		}
		if (on) {
			if (recolorUserContent) recolorTree(document);
			else restoreTree();
			themeEditors();
			if (!mo) {
				mo = new MutationObserver(schedule);
				mo.observe(document.body, {
					childList: true,
					subtree: true
				});
			}
		} else if (was || mo) {
			mo?.disconnect();
			mo = null;
			restoreTree();
			themeEditors();
		}
	}
	var RIPPLE_TARGETS = [
		".btn",
		".Button",
		".ui-button",
		"#section-tabs li.section a",
		".ic-app-header__menu-list-link",
		".ic-DashboardCard__action",
		".ef-item-row",
		".ig-header .ig-header-title"
	].join(",");
	var reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	function bezier(x1, y1, x2, y2) {
		const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
		const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
		const sx = (t) => ((ax * t + bx) * t + cx) * t;
		const sy = (t) => ((ay * t + by) * t + cy) * t;
		const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
		return (x) => {
			if (x <= 0) return 0;
			if (x >= 1) return 1;
			let t = x;
			for (let i = 0; i < 8; i++) {
				const err = sx(t) - x;
				if (Math.abs(err) < 1e-5) break;
				const d = dx(t);
				if (Math.abs(d) < 1e-6) break;
				t -= err / d;
			}
			return sy(Math.min(1, Math.max(0, t)));
		};
	}
	function ripple(e) {
		if (e.button !== 0 || reduceMotion()) return;
		if (!document.documentElement.hasAttribute("data-mc-theme")) return;
		const host = e.target?.closest(RIPPLE_TARGETS);
		if (!host || host.disabled) return;
		const surface = host.matches(".ic-app-header__menu-list-link") ? host.querySelector(".menu-item-icon-container") ?? host : host;
		if (getComputedStyle(surface).position === "static") surface.style.position = "relative";
		surface.style.isolation = "isolate";
		const clip = document.createElement("span");
		clip.className = "mc-ripple-clip";
		clip.style.cssText = "position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:-1;";
		const r = surface.getBoundingClientRect();
		const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
		const dot = document.createElement("span");
		dot.className = "mc-ripple";
		dot.style.width = dot.style.height = `${size}px`;
		dot.style.left = `${e.clientX - r.left - size / 2}px`;
		dot.style.top = `${e.clientY - r.top - size / 2}px`;
		clip.append(dot);
		surface.append(clip);
		const grow = dot.animate([{
			transform: "scale(0)",
			opacity: .2
		}, {
			transform: "scale(1)",
			opacity: .14
		}], {
			duration: 450,
			easing: "cubic-bezier(0.2, 0, 0, 1)",
			fill: "forwards"
		});
		const release = () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
			grow.finished.catch(() => {}).finally(() => {
				dot.animate([{ opacity: .14 }, { opacity: 0 }], {
					duration: 250,
					easing: "cubic-bezier(0.3, 0, 0.8, 0.15)",
					fill: "forwards"
				}).finished.then(() => clip.remove(), () => clip.remove());
			});
		};
		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);
	}
	function patchJQueryEasing() {
		const jq = _unsafeWindow.jQuery;
		if (!jq?.easing) return false;
		const standard = bezier(.2, 0, 0, 1);
		const decel = bezier(.05, .7, .1, 1);
		const wrap = (fn) => function(p, _t, b, c) {
			const v = fn(p);
			return b !== void 0 && c !== void 0 && arguments.length > 3 ? b + c * v : v;
		};
		jq.easing.swing = wrap(standard);
		jq.easing.mcStandard = wrap(standard);
		jq.easing.mcDecelerate = wrap(decel);
		jq.easing._default = "swing";
		return true;
	}
	var leaveTimer = 0;
	function setLeaving(on) {
		const html = document.documentElement;
		clearTimeout(leaveTimer);
		if (!on) {
			html.classList.remove("mc-leaving");
			return;
		}
		if (!html.hasAttribute("data-mc-theme") || !document.body) return;
		if (!document.querySelector(".mc-progress")) {
			const bar = document.createElement("div");
			bar.className = "mc-progress";
			bar.setAttribute("aria-hidden", "true");
			document.body.appendChild(bar);
		}
		html.classList.add("mc-leaving");
		leaveTimer = window.setTimeout(() => setLeaving(false), 12e3);
	}
	function isPageNavigation(e) {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
		const a = e.target?.closest("a[href]");
		if (!a || a.hasAttribute("download")) return false;
		if (a.target && a.target !== "_self") return false;
		const href = a.getAttribute("href") ?? "";
		if (!href || href.startsWith("#") || href.startsWith("javascript:") || a.getAttribute("role") === "button") return false;
		let url;
		try {
			url = new URL(a.href);
		} catch {
			return false;
		}
		if (url.origin !== location.origin) return false;
		if (url.pathname === location.pathname && url.search === location.search) return false;
		if (/\/(download|preview)(\?|$)|\/files\/\d+\/download/.test(url.pathname + url.search)) return false;
		return true;
	}
	function watchNavigation() {
		document.addEventListener("click", (e) => {
			if (isPageNavigation(e)) setLeaving(true);
		});
		window.addEventListener("pageshow", () => setLeaving(false));
	}
	function initMotion() {
		watchNavigation();
		document.addEventListener("pointerdown", ripple, {
			capture: true,
			passive: true
		});
		if (!patchJQueryEasing()) {
			const retry = () => patchJQueryEasing();
			document.addEventListener("DOMContentLoaded", retry, { once: true });
			window.addEventListener("load", retry, { once: true });
		}
	}
	var KEY = "logoCache";
	var MAX_BYTES = 524288;
	var styleEl = null;
	function apply$1(data) {
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.setAttribute("data-mc", "logo");
			(document.head ?? document.documentElement).appendChild(styleEl);
		}
		styleEl.textContent = `html:root { --ic-brand-header-image: url("${data}"); }`;
	}
	function primeLogo() {
		const c = _GM_getValue(KEY, null);
		if (c?.data) apply$1(c.data);
	}
	function canvasLogoUrl() {
		for (const sheet of Array.from(document.styleSheets)) {
			if (!sheet.href || !sheet.href.includes("/variables-")) continue;
			let rules;
			try {
				rules = sheet.cssRules;
			} catch {
				continue;
			}
			for (const r of Array.from(rules)) {
				if (!(r instanceof CSSStyleRule)) continue;
				const m = r.style.getPropertyValue("--ic-brand-header-image").match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
				if (m) return new URL(m[1], location.href).href;
			}
		}
		return null;
	}
	var refreshing = false;
	function refreshLogo() {
		if (refreshing) return;
		const src = canvasLogoUrl();
		if (!src) return;
		const cached = _GM_getValue(KEY, null);
		if (cached?.src === src && cached.data) {
			if (styleEl && styleEl.parentNode !== document.head) document.head.appendChild(styleEl);
			return;
		}
		refreshing = true;
		_GM_xmlhttpRequest({
			url: src,
			method: "GET",
			responseType: "blob",
			onload: (res) => {
				const blob = res.response;
				if (res.status !== 200 || !blob || blob.size > MAX_BYTES || !/^image\//.test(blob.type)) {
					refreshing = false;
					return;
				}
				const reader = new FileReader();
				reader.onload = () => {
					const data = String(reader.result);
					_GM_setValue(KEY, {
						src,
						data
					});
					apply$1(data);
					refreshing = false;
				};
				reader.onerror = () => refreshing = false;
				reader.readAsDataURL(blob);
			},
			onerror: () => refreshing = false,
			ontimeout: () => refreshing = false
		});
	}
	var tokens_default = "html[data-mc-theme]{--mc-font:\"Roboto\", \"Segoe UI Variable Text\", \"Segoe UI\", \"Noto Sans SC\", \"PingFang SC\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", system-ui, sans-serif;--mc-shape-xs:4px;--mc-shape-sm:8px;--mc-shape-md:12px;--mc-shape-lg:16px;--mc-shape-xl:28px;--mc-shape-full:999px;--mc-elev-1:0 1px 2px #0000004d, 0 1px 3px 1px #00000026;--mc-elev-2:0 1px 2px #0000004d, 0 2px 6px 2px #00000026;--mc-elev-3:0 1px 3px #0000004d, 0 4px 8px 3px #00000026;--mc-elev-4:0 2px 3px #0000004d, 0 6px 10px 4px #00000026;--mc-hover:8%;--mc-focus:10%;--mc-press:10%;--mc-ease:cubic-bezier(.2, 0, 0, 1);--mc-ease-decel:cubic-bezier(.05, .7, .1, 1);--mc-ease-accel:cubic-bezier(.3, 0, .8, .15);--mc-ease-spring:cubic-bezier(.34, 1.4, .64, 1);--mc-dur:.2s;--mc-dur-short:.15s;--mc-dur-medium:.3s;--mc-dur-long:.45s;--ic-brand-primary:var(--md-sys-color-primary);--ic-brand-primary-darkened-5:color-mix(in srgb, var(--md-sys-color-primary) 92%, var(--md-sys-color-on-surface));--ic-brand-primary-darkened-10:color-mix(in srgb, var(--md-sys-color-primary) 88%, var(--md-sys-color-on-surface));--ic-brand-primary-darkened-15:color-mix(in srgb, var(--md-sys-color-primary) 84%, var(--md-sys-color-on-surface));--ic-brand-primary-lightened-5:color-mix(in srgb, var(--md-sys-color-primary) 92%, var(--md-sys-color-surface));--ic-brand-primary-lightened-10:color-mix(in srgb, var(--md-sys-color-primary) 88%, var(--md-sys-color-surface));--ic-brand-primary-lightened-15:color-mix(in srgb, var(--md-sys-color-primary) 84%, var(--md-sys-color-surface));--ic-link-color:var(--md-sys-color-primary);--ic-link-color-darkened-10:color-mix(in srgb, var(--md-sys-color-primary) 85%, var(--md-sys-color-on-surface));--ic-link-color-lightened-10:color-mix(in srgb, var(--md-sys-color-primary) 85%, var(--md-sys-color-surface));--ic-brand-font-color-dark:var(--md-sys-color-on-surface);--ic-brand-font-color-dark-lightened-15:var(--md-sys-color-on-surface-variant);--ic-brand-font-color-dark-lightened-28:var(--md-sys-color-on-surface-variant);--ic-brand-button--primary-bgd:var(--md-sys-color-primary);--ic-brand-button--primary-bgd-darkened-5:color-mix(in srgb, var(--md-sys-color-primary) 92%, var(--md-sys-color-on-primary));--ic-brand-button--primary-bgd-darkened-15:color-mix(in srgb, var(--md-sys-color-primary) 88%, var(--md-sys-color-on-primary));--ic-brand-button--primary-text:var(--md-sys-color-on-primary);--ic-brand-button--secondary-bgd:var(--md-sys-color-secondary-container);--ic-brand-button--secondary-bgd-darkened-5:color-mix(in srgb, var(--md-sys-color-secondary-container) 92%, var(--md-sys-color-on-secondary-container));--ic-brand-button--secondary-bgd-darkened-15:color-mix(in srgb, var(--md-sys-color-secondary-container) 88%, var(--md-sys-color-on-secondary-container));--ic-brand-button--secondary-text:var(--md-sys-color-on-secondary-container);--ic-brand-global-nav-bgd:var(--md-sys-color-surface-container);--ic-brand-global-nav-logo-bgd:var(--md-sys-color-surface-container);--ic-brand-global-nav-ic-icon-svg-fill:var(--md-sys-color-on-surface-variant);--ic-brand-global-nav-ic-icon-svg-fill--active:var(--md-sys-color-on-secondary-container);--ic-brand-global-nav-menu-item__text-color:var(--md-sys-color-on-surface-variant);--ic-brand-global-nav-menu-item__text-color--active:var(--md-sys-color-on-surface);--ic-brand-global-nav-avatar-border:var(--md-sys-color-outline-variant);--ic-brand-global-nav-menu-item__badge-bgd:var(--md-sys-color-error);--ic-brand-global-nav-menu-item__badge-bgd--active:var(--md-sys-color-error);--ic-brand-global-nav-menu-item__badge-text:var(--md-sys-color-on-error);--ic-brand-global-nav-menu-item__badge-text--active:var(--md-sys-color-on-error);--ic-brand-Login-body-bgd-color:var(--md-sys-color-surface-container);--ic-brand-msapplication-tile-color:var(--md-sys-color-primary)}";
	var base_default = "html[data-mc-theme]{background:var(--md-sys-color-surface);accent-color:var(--md-sys-color-primary)}html[data-mc-theme] body{background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);font-family:var(--mc-font);-webkit-font-smoothing:antialiased}html[data-mc-theme] body,html[data-mc-theme] button,html[data-mc-theme] input,html[data-mc-theme] select,html[data-mc-theme] textarea,html[data-mc-theme] .ui-widget,html[data-mc-theme] .ui-widget button,html[data-mc-theme] .ui-widget input,html[data-mc-theme] .ui-widget select,html[data-mc-theme] .ui-widget textarea{font-family:var(--mc-font)}html[data-mc-theme] ::selection{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}html[data-mc-theme] a,html[data-mc-theme] .btn-link{color:var(--md-sys-color-primary)}html[data-mc-theme] h1,html[data-mc-theme] h2,html[data-mc-theme] h3,html[data-mc-theme] h4,html[data-mc-theme] h5,html[data-mc-theme] h6{color:var(--md-sys-color-on-surface)}html[data-mc-theme] h1{letter-spacing:0;font-weight:400}html[data-mc-theme] h2{font-weight:400}html[data-mc-theme] h3,html[data-mc-theme] h4{font-weight:500}html[data-mc-theme] hr{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] code,html[data-mc-theme] pre{background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);border-color:var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-xs)}html[data-mc-theme] :focus-visible{outline-offset:2px;outline:3px solid var(--md-sys-color-secondary)!important}html[data-mc-theme]{scrollbar-color:var(--md-sys-color-outline-variant) transparent}html[data-mc-theme] ::-webkit-scrollbar{width:12px;height:12px}html[data-mc-theme] ::-webkit-scrollbar-track{background:0 0}html[data-mc-theme] ::-webkit-scrollbar-thumb{background:var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-full);background-clip:content-box;border:3px solid #0000}html[data-mc-theme] ::-webkit-scrollbar-thumb:hover{background-color:var(--md-sys-color-outline)}html[data-mc-theme] .ic-Layout-wrapper,html[data-mc-theme] #main,html[data-mc-theme] .ic-app-main-content,html[data-mc-theme] #content,html[data-mc-theme] .ic-Layout-contentMain{background:0 0}html[data-mc-theme] .text-muted,html[data-mc-theme] .muted,html[data-mc-theme] .text-info{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .text-error,html[data-mc-theme] .error-text{color:var(--md-sys-color-error)}html[data-mc-theme] .text-success{color:var(--mc-success)}";
	var components_default = "html[data-mc-theme] .btn,html[data-mc-theme] .Button,html[data-mc-theme] .ui-button,html[data-mc-theme] .ui-dialog .ui-dialog-buttonpane button{font-family:var(--mc-font);letter-spacing:.01em;border-radius:var(--mc-shape-full);border:1px solid var(--md-sys-color-outline);min-height:40px;color:var(--md-sys-color-primary);box-shadow:none;text-shadow:none;transition:background-color var(--mc-dur) var(--mc-ease), box-shadow var(--mc-dur) var(--mc-ease);box-sizing:border-box;background:0 0;padding:10px 20px;font-size:.875rem;font-weight:500;line-height:1.25rem}html[data-mc-theme] .btn:hover,html[data-mc-theme] .Button:hover,html[data-mc-theme] .ui-button:hover{background:color-mix(in srgb, var(--md-sys-color-primary) var(--mc-hover), transparent);color:var(--md-sys-color-primary);text-decoration:none}html[data-mc-theme] .btn:active,html[data-mc-theme] .Button:active,html[data-mc-theme] .btn.active{background:color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);box-shadow:none}html[data-mc-theme] .btn i[class*=icon-],html[data-mc-theme] .Button i[class*=icon-]{color:inherit}html[data-mc-theme] .btn-primary,html[data-mc-theme] .Button--primary,html[data-mc-theme] .btn.btn-primary,html[data-mc-theme] .Button.Button--primary,html[data-mc-theme] .ui-dialog .ui-dialog-buttonpane .btn-primary{background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);border-color:#0000}html[data-mc-theme] .btn-primary:hover,html[data-mc-theme] .Button--primary:hover,html[data-mc-theme] .btn-primary:focus,html[data-mc-theme] .Button--primary:focus{background:color-mix(in srgb, var(--md-sys-color-primary), var(--md-sys-color-on-primary) var(--mc-hover));color:var(--md-sys-color-on-primary);box-shadow:var(--mc-elev-1)}html[data-mc-theme] .Button--secondary,html[data-mc-theme] .btn-secondary,html[data-mc-theme] .button-sidebar-wide,html[data-mc-theme] .Button--success.Button--secondary{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container);border-color:#0000}html[data-mc-theme] .Button--secondary:hover,html[data-mc-theme] .btn-secondary:hover,html[data-mc-theme] .button-sidebar-wide:hover{background:color-mix(in srgb, var(--md-sys-color-secondary-container), var(--md-sys-color-on-secondary-container) var(--mc-hover));color:var(--md-sys-color-on-secondary-container);box-shadow:var(--mc-elev-1)}html[data-mc-theme] .btn-danger,html[data-mc-theme] .Button--danger{background:var(--md-sys-color-error);color:var(--md-sys-color-on-error);border-color:#0000}html[data-mc-theme] .btn-success,html[data-mc-theme] .Button--success{background:var(--mc-success);color:var(--mc-on-success);border-color:#0000}html[data-mc-theme] .Button--link,html[data-mc-theme] .btn-link,html[data-mc-theme] .Button--icon-action,html[data-mc-theme] .Button--icon-action-rev,html[data-mc-theme] .al-trigger.btn,html[data-mc-theme] .Button.al-trigger{background:0 0;border-color:#0000;padding-inline:12px}html[data-mc-theme] .Button--icon-action,html[data-mc-theme] .Button--icon-action-rev,html[data-mc-theme] .al-trigger{min-width:40px;color:var(--md-sys-color-on-surface-variant);padding:8px}html[data-mc-theme] .Button--small,html[data-mc-theme] .btn-small,html[data-mc-theme] .btn-mini{min-height:32px;padding:6px 14px;font-size:.8125rem}html[data-mc-theme] .Button--small.Button--icon-action,html[data-mc-theme] .btn-mini.al-trigger{min-width:32px;padding:4px}html[data-mc-theme] .btn[disabled],html[data-mc-theme] .Button[disabled],html[data-mc-theme] .btn.disabled{background:color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);color:color-mix(in srgb, var(--md-sys-color-on-surface) 38%, transparent);box-shadow:none;opacity:1;border-color:#0000}html[data-mc-theme] .btn-group>.btn{border-radius:0}html[data-mc-theme] .btn-group>.btn:first-child{border-start-start-radius:var(--mc-shape-full);border-end-start-radius:var(--mc-shape-full)}html[data-mc-theme] .btn-group>.btn:last-child{border-start-end-radius:var(--mc-shape-full);border-end-end-radius:var(--mc-shape-full)}html[data-mc-theme] button>span[class$=_caGd],html[data-mc-theme] a>span[class$=_caGd]{border-radius:var(--mc-shape-full)}html[data-mc-theme] input[type=text],html[data-mc-theme] input[type=password],html[data-mc-theme] input[type=email],html[data-mc-theme] input[type=url],html[data-mc-theme] input[type=search],html[data-mc-theme] input[type=number],html[data-mc-theme] input[type=tel],html[data-mc-theme] input[type=date],html[data-mc-theme] input[type=datetime-local],html[data-mc-theme] input[type=time],html[data-mc-theme] select,html[data-mc-theme] textarea,html[data-mc-theme] .ic-Input,html[data-mc-theme] .uneditable-input{background:var(--md-sys-color-surface-container-highest);color:var(--md-sys-color-on-surface);border:none;border-bottom:1px solid var(--md-sys-color-on-surface-variant);border-radius:var(--mc-shape-xs) var(--mc-shape-xs) 0 0;box-shadow:none;font-family:var(--mc-font);transition:border-color var(--mc-dur) var(--mc-ease), box-shadow var(--mc-dur) var(--mc-ease)}html[data-mc-theme] input[type=text]:hover,html[data-mc-theme] input[type=password]:hover,html[data-mc-theme] select:hover,html[data-mc-theme] textarea:hover,html[data-mc-theme] .ic-Input:hover{background:color-mix(in srgb, var(--md-sys-color-surface-container-highest), var(--md-sys-color-on-surface) var(--mc-hover))}html[data-mc-theme] input[type=text]:focus,html[data-mc-theme] input[type=password]:focus,html[data-mc-theme] input[type=email]:focus,html[data-mc-theme] input[type=url]:focus,html[data-mc-theme] input[type=search]:focus,html[data-mc-theme] input[type=number]:focus,html[data-mc-theme] select:focus,html[data-mc-theme] textarea:focus,html[data-mc-theme] .ic-Input:focus{border-bottom-color:var(--md-sys-color-primary);box-shadow:inset 0 -2px 0 var(--md-sys-color-primary);outline:none!important}html[data-mc-theme] input::placeholder,html[data-mc-theme] textarea::placeholder{color:var(--md-sys-color-on-surface-variant);opacity:.8}html[data-mc-theme] input[type=checkbox],html[data-mc-theme] input[type=radio]{accent-color:var(--md-sys-color-primary);width:18px;height:18px}html[data-mc-theme] label,html[data-mc-theme] .ic-Label,html[data-mc-theme] .ic-Form-control label{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ic-Form-message--error,html[data-mc-theme] .error_box .error_text,html[data-mc-theme] .errorBox{color:var(--md-sys-color-error)}html[data-mc-theme] fieldset{border-color:var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md)}html[data-mc-theme] legend{color:var(--md-sys-color-on-surface)}html[data-mc-theme] table.table,html[data-mc-theme] .ic-Table,html[data-mc-theme] table.summary,html[data-mc-theme] table.ic-Table{border-collapse:separate;border-spacing:0;border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md);background:0 0;overflow:hidden}html[data-mc-theme] .table th,html[data-mc-theme] .ic-Table th,html[data-mc-theme] table.summary th,html[data-mc-theme] table.summary thead th{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface-variant);border-color:var(--md-sys-color-outline-variant);font-weight:500}html[data-mc-theme] .table td,html[data-mc-theme] .ic-Table td,html[data-mc-theme] table.summary td{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .table-striped tbody>tr:nth-child(odd)>td,html[data-mc-theme] .ic-Table--striped tbody tr:nth-child(odd),html[data-mc-theme] .ic-Table.ic-Table--striped>tbody>tr:nth-child(odd)>td{background:var(--md-sys-color-surface-container-low)}html[data-mc-theme] .table-hover tbody tr:hover>td,html[data-mc-theme] .ic-Table--hover-row tbody tr:hover>td{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent)}html[data-mc-theme] .ui-menu,html[data-mc-theme] .al-options,html[data-mc-theme] .dropdown-menu,html[data-mc-theme] .ui-autocomplete,html[data-mc-theme] .ui-kyle-menu,html[data-mc-theme] .popover{background:var(--md-sys-color-surface-container);border-radius:var(--mc-shape-sm);box-shadow:var(--mc-elev-2);color:var(--md-sys-color-on-surface);border:none;padding:8px 0}html[data-mc-theme] .ui-menu .ui-menu-item a,html[data-mc-theme] .ui-menu .ui-menu-item>*,html[data-mc-theme] .dropdown-menu>li>a{color:var(--md-sys-color-on-surface);background:0 0;border:none;border-radius:0;min-height:32px;padding:8px 16px}html[data-mc-theme] .ui-menu .ui-menu-item a.ui-state-focus,html[data-mc-theme] .ui-menu .ui-menu-item a.ui-state-active,html[data-mc-theme] .ui-menu .ui-menu-item a:hover,html[data-mc-theme] .ui-menu .ui-menu-item .ui-state-focus,html[data-mc-theme] .dropdown-menu>li>a:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent);color:var(--md-sys-color-on-surface);margin:0}html[data-mc-theme] .ui-menu .ui-menu-divider,html[data-mc-theme] .dropdown-menu .divider{border-color:var(--md-sys-color-outline-variant);background:var(--md-sys-color-outline-variant)}html[data-mc-theme] [role=menu]:not(nav [role=menu]){border-radius:var(--mc-shape-sm)}html[data-mc-theme] .ui-dialog{background:var(--md-sys-color-surface-container-high);border-radius:var(--mc-shape-xl);box-shadow:var(--mc-elev-3);border:none;padding:0;overflow:hidden}html[data-mc-theme] .ui-dialog .ui-dialog-titlebar{background:0 0;border:none;padding:24px 24px 8px}html[data-mc-theme] .ui-dialog .ui-dialog-title{color:var(--md-sys-color-on-surface);font-size:1.5rem;font-weight:400}html[data-mc-theme] .ui-dialog .ui-dialog-titlebar-close{border-radius:var(--mc-shape-full);top:20px;right:16px}html[data-mc-theme] .ui-dialog .ui-dialog-content{color:var(--md-sys-color-on-surface-variant);background:0 0;padding:8px 24px}html[data-mc-theme] .ui-dialog .ui-dialog-buttonpane{background:0 0;border:none;padding:16px 24px 24px}html[data-mc-theme] .ui-widget-overlay{background:var(--md-sys-color-scrim);opacity:.32}html[data-mc-theme] .ui-widget-content{color:var(--md-sys-color-on-surface)}html[data-mc-theme] .ui-widget-header{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] [role=dialog][aria-modal=true]>div:first-child,html[data-mc-theme] span[dir]>[role=dialog]{border-radius:var(--mc-shape-xl)}html[data-mc-theme] .alert,html[data-mc-theme] .ic-flash-info,html[data-mc-theme] .ic-flash-success,html[data-mc-theme] .ic-flash-warning,html[data-mc-theme] .ic-flash-error{border-radius:var(--mc-shape-md);box-shadow:none;text-shadow:none;background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);border:none}html[data-mc-theme] .alert-info,html[data-mc-theme] .ic-flash-info{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}html[data-mc-theme] .alert-success,html[data-mc-theme] .ic-flash-success{background:var(--mc-success-container);color:var(--mc-on-success-container)}html[data-mc-theme] .alert-error,html[data-mc-theme] .alert-danger,html[data-mc-theme] .ic-flash-error{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}html[data-mc-theme] .alert-warning,html[data-mc-theme] .ic-flash-warning{background:var(--mc-warning-container);color:var(--mc-on-warning-container)}html[data-mc-theme] .ic-flash-info .ic-flash__icon,html[data-mc-theme] .ic-flash-success .ic-flash__icon,html[data-mc-theme] .ic-flash-warning .ic-flash__icon,html[data-mc-theme] .ic-flash-error .ic-flash__icon{color:inherit;background:0 0}html[data-mc-theme] #flash_message_holder li{border-radius:var(--mc-shape-xs);box-shadow:var(--mc-elev-3)}:is(html[data-mc-theme] .badge,html[data-mc-theme] .ic-badge,html[data-mc-theme] .menu-item__badge,html[data-mc-theme] .nav-badge,html[data-mc-theme] .unread_count,html[data-mc-theme] .unread-count):empty{display:none}html[data-mc-theme] .badge,html[data-mc-theme] .ic-badge,html[data-mc-theme] .menu-item__badge,html[data-mc-theme] .nav-badge,html[data-mc-theme] .unread_count,html[data-mc-theme] .unread-count{background:var(--md-sys-color-error);color:var(--md-sys-color-on-error);border-radius:var(--mc-shape-full);box-shadow:none;border:none}html[data-mc-theme] .label,html[data-mc-theme] .pill,html[data-mc-theme] .ic-Pill{border-radius:var(--mc-shape-sm)}html[data-mc-theme] .ui-tooltip,html[data-mc-theme] .ui-tooltip-content,html[data-mc-theme] .tooltip-inner{background:var(--md-sys-color-inverse-surface);color:var(--md-sys-color-inverse-on-surface);border-radius:var(--mc-shape-xs);box-shadow:none;border:none;font-size:.75rem}html[data-mc-theme] .ui-tabs{background:0 0;border:none;padding:0}html[data-mc-theme] .ui-tabs .ui-tabs-nav{border:none;border-bottom:1px solid var(--md-sys-color-surface-variant);background:0 0;border-radius:0;padding:0}html[data-mc-theme] .ui-tabs .ui-tabs-nav li{background:0 0;border:none;margin:0;top:0}html[data-mc-theme] .ui-tabs .ui-tabs-nav li a{color:var(--md-sys-color-on-surface-variant);padding:14px 16px;font-weight:500}html[data-mc-theme] .ui-tabs .ui-tabs-nav li.ui-tabs-active a,html[data-mc-theme] .ui-tabs .ui-tabs-nav li.ui-state-active a{color:var(--md-sys-color-primary);box-shadow:inset 0 -3px 0 var(--md-sys-color-primary)}html[data-mc-theme] .ui-tabs .ui-tabs-panel{background:0 0;border:none}html[data-mc-theme] .item-group-condensed,html[data-mc-theme] .item-group-container .item-group-condensed{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md);background:0 0;margin-bottom:16px;padding:0;overflow:hidden}html[data-mc-theme] .ig-header,html[data-mc-theme] .item-group-condensed .ig-header{background:var(--md-sys-color-surface-container);border:none;border-bottom:1px solid var(--md-sys-color-outline-variant);padding-block:10px}html[data-mc-theme] .ig-header .ig-header-title,html[data-mc-theme] .ig-header .name{color:var(--md-sys-color-on-surface);font-weight:500}html[data-mc-theme] .ig-list .ig-row,html[data-mc-theme] .item-group-condensed .ig-row{border-color:var(--md-sys-color-outline-variant);transition:background-color var(--mc-dur) var(--mc-ease);background:0 0}html[data-mc-theme] .ig-list .ig-row:hover,html[data-mc-theme] .item-group-condensed .ig-row:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}html[data-mc-theme] .ig-list .ig-row.ig-published,html[data-mc-theme] .ig-row.ig-published{border-left-color:#0000}html[data-mc-theme] .ig-details,html[data-mc-theme] .ig-details__item{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ig-title{color:var(--md-sys-color-on-surface);font-weight:500}html[data-mc-theme] .ic-notification,html[data-mc-theme] .content-box,html[data-mc-theme] .border,html[data-mc-theme] .border-round{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .pagination ul>li>a,html[data-mc-theme] .pagination ul>li>span{border-radius:var(--mc-shape-full);color:var(--md-sys-color-on-surface-variant);background:0 0;border:none;margin:0 2px}html[data-mc-theme] .pagination ul>.active>a,html[data-mc-theme] .pagination ul>.active>span{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] .pagination ul{box-shadow:none}";
	var layout_default = "html[data-mc-theme] .ic-app-header{background:var(--md-sys-color-surface-container);box-shadow:none;border-right:none}html[data-mc-theme] .ic-app-header__logomark-container{background:0 0}html[data-mc-theme] .ic-app-header__logomark{border-radius:var(--mc-shape-lg);transition:background-color var(--mc-dur) var(--mc-ease);margin:8px}html[data-mc-theme][data-mc-theme=light] .ic-app-header__logomark{filter:brightness(0);opacity:.72}html[data-mc-theme] .ic-app-header__logomark:hover{opacity:1}html[data-mc-theme] .ic-app-header__menu-list-item{background:0 0}html[data-mc-theme] .ic-app-header__menu-list-link{color:var(--md-sys-color-on-surface-variant);box-shadow:none;padding-block:6px;background:0 0!important}html[data-mc-theme] .ic-app-header__menu-list-link .menu-item-icon-container{border-radius:var(--mc-shape-full);width:56px;height:32px;transition:background-color var(--mc-dur) var(--mc-ease);justify-content:center;align-items:center;margin:0 auto 4px;display:flex;position:relative}html[data-mc-theme] .ic-app-header__menu-list-link:hover .menu-item-icon-container{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent)}html[data-mc-theme] .ic-app-header__menu-list-link .ic-icon-svg,html[data-mc-theme] .ic-app-header__menu-list-link svg{fill:var(--md-sys-color-on-surface-variant);color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ic-app-header__menu-list-link .menu-item__text{letter-spacing:.03em;color:var(--md-sys-color-on-surface-variant);font-size:.75rem;font-weight:500}html[data-mc-theme] .ic-app-header__menu-list-item--active .ic-app-header__menu-list-link,html[data-mc-theme] .ic-app-header__menu-list-item--active .ic-app-header__menu-list-link:hover{background:0 0!important}html[data-mc-theme] .ic-app-header__menu-list-item--active .menu-item-icon-container{background-position:50%;background-repeat:no-repeat;background-size:100% 100%;background-color:#0000!important;background-image:linear-gradient(var(--md-sys-color-secondary-container), var(--md-sys-color-secondary-container))!important}html[data-mc-theme] .ic-app-header__menu-list-item--active .ic-icon-svg,html[data-mc-theme] .ic-app-header__menu-list-item--active svg{fill:var(--md-sys-color-on-secondary-container);color:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] .ic-app-header__menu-list-item--active .menu-item__text{color:var(--md-sys-color-on-surface);font-weight:700}html[data-mc-theme] .ic-app-header__menu-list-link>img:has(+.mc-nav-icon-wrap){display:none}html[data-mc-theme] .mc-nav-img-icon{background:var(--md-sys-color-on-surface-variant);width:24px;height:24px;-webkit-mask:var(--mc-icon) center / contain no-repeat;-webkit-mask:var(--mc-icon) center / contain no-repeat;mask:var(--mc-icon) center / contain no-repeat}html[data-mc-theme] .ic-app-header__menu-list-item--active .mc-nav-img-icon{background:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] .ic-app-header__menu-list-link .menu-item__badge:empty{display:none}html[data-mc-theme] .ic-app-header__menu-list-link .menu-item__badge{background:var(--md-sys-color-error);min-width:16px;height:16px;color:var(--md-sys-color-on-error);padding:0 4px;font-size:.6875rem;line-height:16px;position:absolute;top:-2px;left:auto;right:6px}html[data-mc-theme] .ic-app-header__menu-list-link .ic-avatar{border:2px solid var(--md-sys-color-outline-variant);width:28px;height:28px}html[data-mc-theme] body:not(.primary-nav-expanded) .ic-app-header__menu-list-link .menu-item-icon-container{width:48px}html[data-mc-theme] #nav-tray-portal [role=dialog],html[data-mc-theme] .navigation-tray-container{color:var(--md-sys-color-on-surface);border-radius:0 var(--mc-shape-lg) var(--mc-shape-lg) 0;box-shadow:var(--mc-elev-1);background:var(--md-sys-color-surface-container-low)!important}html[data-mc-theme] #nav-tray-portal [role=dialog]>div,html[data-mc-theme] .navigation-tray-container>div{background:0 0!important}html[data-mc-theme] #nav-tray-portal a,html[data-mc-theme] .navigation-tray-container a{color:var(--md-sys-color-primary)}html[data-mc-theme] #nav-tray-portal li a,html[data-mc-theme] .navigation-tray-container li a{border-radius:var(--mc-shape-full);transition:background-color var(--mc-dur) var(--mc-ease);margin-inline-start:-12px;padding:6px 12px;display:inline-block}html[data-mc-theme] #nav-tray-portal li a:hover,html[data-mc-theme] .navigation-tray-container li a:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent);text-decoration:none}html[data-mc-theme] .mobile-header{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);box-shadow:none}html[data-mc-theme] .mobile-header .mobile-header-title,html[data-mc-theme] .mobile-header button,html[data-mc-theme] .mobile-header-hamburger .icon-hamburger:before{color:var(--md-sys-color-on-surface)}html[data-mc-theme] .ic-app-nav-toggle-and-crumbs{background:var(--md-sys-color-surface);border-bottom:none;min-height:64px}html[data-mc-theme] .ic-app-course-nav-toggle,html[data-mc-theme] #courseMenuToggle{border-radius:var(--mc-shape-full);width:40px;height:40px;color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ic-app-course-nav-toggle:hover,html[data-mc-theme] #courseMenuToggle:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent)}html[data-mc-theme] .ic-app-course-nav-toggle i:before,html[data-mc-theme] #courseMenuToggle i:before{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] #breadcrumbs,html[data-mc-theme] .ic-app-crumbs{color:var(--md-sys-color-on-surface-variant);background:0 0}html[data-mc-theme] #breadcrumbs>ul>li{font-size:1.125rem}html[data-mc-theme] #breadcrumbs>ul>li+li:before{color:var(--md-sys-color-outline)}html[data-mc-theme] #breadcrumbs>ul>li a{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] #breadcrumbs>ul>li:last-child,html[data-mc-theme] #breadcrumbs>ul>li:last-child a{color:var(--md-sys-color-on-surface);font-weight:500}html[data-mc-theme] #breadcrumbs .home .icon-home:before{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] #left-side,html[data-mc-theme] .ic-app-course-menu{background:var(--md-sys-color-surface)}html[data-mc-theme] #section-tabs-header-subtitle{color:var(--md-sys-color-on-surface-variant);padding-inline:16px;font-size:.75rem;font-weight:500}html[data-mc-theme] #section-tabs{margin:0 8px 0 0}html[data-mc-theme] #section-tabs li.section a,html[data-mc-theme] #section-tabs li.section .section-hidden{border-radius:var(--mc-shape-full);min-height:40px;color:var(--md-sys-color-on-surface-variant);transition:background-color var(--mc-dur) var(--mc-ease);border:none;align-items:center;margin-block:1px;padding:0 16px;font-size:.875rem;font-weight:500;text-decoration:none;display:flex}html[data-mc-theme] #section-tabs li.section a:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent);color:var(--md-sys-color-on-surface);text-decoration:none}html[data-mc-theme] #section-tabs li.section a.active,html[data-mc-theme] #section-tabs li.section a[aria-current=page]{background:linear-gradient(var(--md-sys-color-secondary-container), var(--md-sys-color-secondary-container)) left center / 100% 100% no-repeat;color:var(--md-sys-color-on-secondary-container);border:none;font-weight:700}html[data-mc-theme] #section-tabs li.section a.active:before{display:none}html[data-mc-theme] #right-side-wrapper,html[data-mc-theme] .ic-app-main-content__secondary,html[data-mc-theme] #right-side{background:0 0}html[data-mc-theme] #right-side .button-sidebar-wide,html[data-mc-theme] #right-side .btn.button-sidebar-wide{text-align:start;justify-content:flex-start;align-items:center;gap:8px;margin-bottom:8px;display:flex}html[data-mc-theme] #right-side .button-sidebar-wide img.icon{width:18px;height:18px;margin:0}html[data-mc-theme] #right-side h2,html[data-mc-theme] .todo-list-header,html[data-mc-theme] .Sidebar__TodoListContainer h2{color:var(--md-sys-color-on-surface);border-bottom:none;font-size:1rem;font-weight:500}html[data-mc-theme] .ToDoSidebarItem{border-radius:var(--mc-shape-sm)}html[data-mc-theme] .ic-app-footer{border-top:1px solid var(--md-sys-color-outline-variant);background:0 0}html[data-mc-theme] .ic-app-footer a{color:var(--md-sys-color-on-surface-variant)}";
	var dashboard_default = "html[data-mc-theme] .ic-Dashboard-header__layout{border-bottom:none;padding-block:8px}html[data-mc-theme] .ic-Dashboard-header__title{color:var(--md-sys-color-on-surface);font-size:2rem;font-weight:400}html[data-mc-theme] .ic-DashboardCard__box{gap:16px}html[data-mc-theme] .ic-DashboardCard{background:var(--md-sys-color-surface-container-low);border-radius:var(--mc-shape-md);box-shadow:var(--mc-elev-1);transition:box-shadow var(--mc-dur) var(--mc-ease);border:none;overflow:hidden}html[data-mc-theme] .ic-DashboardCard:hover{box-shadow:var(--mc-elev-2)}html[data-mc-theme] .ic-DashboardCard__header_hero{border-radius:0}html[data-mc-theme] .ic-DashboardCard__header_content{background:0 0;padding:16px 16px 8px}html[data-mc-theme] .ic-DashboardCard__header-title{font-size:1rem;font-weight:500;color:var(--md-sys-color-on-surface)!important}html[data-mc-theme] .ic-DashboardCard__header-subtitle,html[data-mc-theme] .ic-DashboardCard__header-term{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ic-DashboardCard__action-container{border:none;padding:4px 8px 8px}html[data-mc-theme] .ic-DashboardCard__action{border-radius:var(--mc-shape-full);color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .ic-DashboardCard__action:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent)}html[data-mc-theme] .ic-DashboardCard__action-badge{background:var(--md-sys-color-error);color:var(--md-sys-color-on-error)}html[data-mc-theme] .ic-DashboardCard__header-button-bg{border-radius:var(--mc-shape-full)}html[data-mc-theme] .planner-day h2{color:var(--md-sys-color-on-surface)}html[data-mc-theme] .planner-day,html[data-mc-theme] .planner-empty-days{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .planner-grouping{border-radius:var(--mc-shape-md);background:0 0;margin-bottom:12px;overflow:hidden;border:1px solid var(--md-sys-color-outline-variant)!important}html[data-mc-theme] .planner-grouping>a:first-child{background:var(--md-sys-color-surface-container);border-radius:0}html[data-mc-theme] .planner-grouping a[class*=hero] span[class*=title]{color:var(--md-sys-color-on-surface);text-transform:none;letter-spacing:0;background:0 0;font-size:.875rem;font-weight:500}html[data-mc-theme] .planner-item{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .planner-completed-items button{border-radius:var(--mc-shape-full)}html[data-mc-theme] .planner-empty-days img,html[data-mc-theme] .planner-empty-days svg{opacity:.9}html[data-mc-theme] .StickyButton-styles__root{border-radius:0 0 var(--mc-shape-md) var(--mc-shape-md);background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);box-shadow:var(--mc-elev-2)}html[data-mc-theme] .ic-Dashboard-Activity .stream_header,html[data-mc-theme] .recent-activity-header{background:var(--md-sys-color-surface-container);border-radius:var(--mc-shape-md);border:none}html[data-mc-theme] .stream-category{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md);margin-bottom:12px;overflow:hidden}html[data-mc-theme] .stream-category .details_container{background:0 0}html[data-mc-theme] .ic-notification{border-radius:var(--mc-shape-md);overflow:hidden}";
	var course_default = "html[data-mc-theme] .header-bar,html[data-mc-theme] .page-toolbar,html[data-mc-theme] .ic-Action-header{background:0 0;border-bottom:none}html[data-mc-theme] .page-title,html[data-mc-theme] .ic-Action-header__Heading,html[data-mc-theme] h1.title,html[data-mc-theme] .show-content h1,html[data-mc-theme] #content>h1:first-child{color:var(--md-sys-color-on-surface);font-size:1.75rem;font-weight:400}html[data-mc-theme] .header-bar-outer-container,html[data-mc-theme] .sticky-toolbar{background:var(--md-sys-color-surface)}html[data-mc-theme] #context_modules .context_module{margin-bottom:16px}html[data-mc-theme] .context_module .ig-header .collapse_module_link i:before,html[data-mc-theme] .context_module .ig-header .expand_module_link i:before,html[data-mc-theme] .context_module_item .ig-type-icon,html[data-mc-theme] .ig-type-icon{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .context_module_item .item_name a,html[data-mc-theme] .module-item-title a{color:var(--md-sys-color-on-surface);font-weight:500}html[data-mc-theme] .context_module_item .item_name a:hover{color:var(--md-sys-color-primary)}html[data-mc-theme] .context_module .footer,html[data-mc-theme] .context_module .progression_container{border-color:var(--md-sys-color-outline-variant);background:0 0}html[data-mc-theme] .module_item_icons .requirement-description,html[data-mc-theme] .requirement-description .pill{border-radius:var(--mc-shape-sm)}html[data-mc-theme] .context_module_item.context_module_item_hover .ig-row,html[data-mc-theme] .context_module_item.selected .ig-row{background:color-mix(in srgb, var(--md-sys-color-primary) 6%, transparent)}html[data-mc-theme] .module-sequence-footer .module-sequence-footer-content{background:var(--md-sys-color-surface-container);border-radius:var(--mc-shape-lg);border:none;padding:8px 12px}html[data-mc-theme] #ag-list .ig-header,html[data-mc-theme] .assignment_group .ig-header{border-radius:0}html[data-mc-theme] .ig-row .ig-type-icon i:before{color:var(--md-sys-color-primary)}html[data-mc-theme] .assignment-date-due,html[data-mc-theme] .assignment-date-available,html[data-mc-theme] .score-display{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .assignment-title .title,html[data-mc-theme] .quiz-header h1{font-weight:400}html[data-mc-theme] .student-assignment-overview,html[data-mc-theme] .assignment_dates,html[data-mc-theme] .ic-Table--condensed,html[data-mc-theme] .quiz-details,html[data-mc-theme] #quiz_details_wrapper{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .student-assignment-overview{background:var(--md-sys-color-surface-container-low);border-radius:var(--mc-shape-md);border:none;padding:12px 16px}html[data-mc-theme] .details .content,html[data-mc-theme] #sidebar_content .details,html[data-mc-theme] .rubric_container,html[data-mc-theme] .rubric_summary{border-radius:var(--mc-shape-md)}html[data-mc-theme] .rubric_container .rubric_table,html[data-mc-theme] table.rubric_table{border-radius:var(--mc-shape-md);border-color:var(--md-sys-color-outline-variant);overflow:hidden}html[data-mc-theme] .rubric_table th,html[data-mc-theme] .rubric_table td{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .rubric_table thead th{background:var(--md-sys-color-surface-container)}html[data-mc-theme] #submit_assignment,html[data-mc-theme] .submit_assignment_link{border-radius:var(--mc-shape-full)}html[data-mc-theme] #submit_assignment{background:var(--md-sys-color-surface-container-low);border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-lg)}html[data-mc-theme] .question,html[data-mc-theme] .display_question{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md);box-shadow:none;background:0 0;overflow:hidden}html[data-mc-theme] .question .header,html[data-mc-theme] .display_question .header{background:var(--md-sys-color-surface-container);border-bottom:1px solid var(--md-sys-color-outline-variant);color:var(--md-sys-color-on-surface)}html[data-mc-theme] .question .answers .answer,html[data-mc-theme] .display_question .answer{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .question .answers .answer:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}html[data-mc-theme] .display_question .answer.selected_answer,html[data-mc-theme] .display_question .answer.correct_answer{background:var(--mc-success-container);color:var(--mc-on-success-container)}html[data-mc-theme] .display_question .answer.wrong_answer{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}html[data-mc-theme] #question_list .list_question{border-radius:var(--mc-shape-sm)}html[data-mc-theme] #quiz-submission-version-table,html[data-mc-theme] .quiz-submission{border-radius:var(--mc-shape-md)}html[data-mc-theme] .ic-item-row,html[data-mc-theme] .discussion-topic,html[data-mc-theme] .announcements-v2__wrapper .ic-item-row{border-color:var(--md-sys-color-outline-variant);background:0 0}html[data-mc-theme] .discussions-v2__wrapper .ic-item-row:hover,html[data-mc-theme] .announcements-v2__wrapper .ic-item-row:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}html[data-mc-theme] .discussions-container__wrapper,html[data-mc-theme] .discussions-v2__container-image,html[data-mc-theme] .announcements-v2__wrapper{border-radius:var(--mc-shape-md)}html[data-mc-theme] .ic-unread-badge__total-count,html[data-mc-theme] .ic-unread-badge__unread-count{border-radius:var(--mc-shape-full)}html[data-mc-theme] .ic-unread-badge__unread-count{background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}html[data-mc-theme] [data-testid=discussion-root-entry-container],html[data-mc-theme] [data-testid=discussion-topic-container]{border-radius:var(--mc-shape-md)}html[data-mc-theme] .user_content,html[data-mc-theme] .show-content{color:var(--md-sys-color-on-surface);line-height:1.6}html[data-mc-theme] .user_content table{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .user_content blockquote{border-left:4px solid var(--md-sys-color-primary);background:var(--md-sys-color-surface-container-low);border-radius:0 var(--mc-shape-sm) var(--mc-shape-sm) 0;padding:8px 16px}html[data-mc-theme] .user_content img{border-radius:var(--mc-shape-xs)}html[data-mc-theme] #syllabus,html[data-mc-theme] #course_syllabus{color:var(--md-sys-color-on-surface)}html[data-mc-theme] #syllabus .detail_list,html[data-mc-theme] #syllabusContainer table{border-radius:var(--mc-shape-md);overflow:hidden}html[data-mc-theme] #syllabus tr.date,html[data-mc-theme] #syllabus .day_date{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] #course_home_content .stream-category,html[data-mc-theme] #course_activity_stream{border-radius:var(--mc-shape-md)}html[data-mc-theme] .events_list .event,html[data-mc-theme] .recent_feedback .event{border-radius:var(--mc-shape-sm)}html[data-mc-theme] .events_list .event:hover,html[data-mc-theme] .recent_feedback .event:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}";
	var tools_default = "html[data-mc-theme] #grades_summary{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-md);border-collapse:separate;border-spacing:0;overflow:hidden}html[data-mc-theme] #grades_summary th{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface-variant);font-weight:500}html[data-mc-theme] #grades_summary tr.student_assignment td,html[data-mc-theme] #grades_summary tr.student_assignment th{border-color:var(--md-sys-color-outline-variant);background:0 0}html[data-mc-theme] #grades_summary tr.student_assignment:hover td,html[data-mc-theme] #grades_summary tr.student_assignment:hover th{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}html[data-mc-theme] #grades_summary tr.group_total td,html[data-mc-theme] #grades_summary tr.group_total th,html[data-mc-theme] #grades_summary tr.final_grade td,html[data-mc-theme] #grades_summary tr.final_grade th{background:var(--md-sys-color-surface-container-low);font-weight:500}html[data-mc-theme] #grades_summary .assignment_score .grade{color:var(--md-sys-color-on-surface)}html[data-mc-theme] .student_grades .comments,html[data-mc-theme] #grades_summary tr.comments td,html[data-mc-theme] #grades_summary tr.rubric_assessments td{background:var(--md-sys-color-surface-container-low)}html[data-mc-theme] #student-grades-right-content,html[data-mc-theme] #student-grades-final,html[data-mc-theme] .student_assignment.editable .grade{color:var(--md-sys-color-on-surface)}html[data-mc-theme] #student-grades-right-content .student_assignment,html[data-mc-theme] #assignments-not-weighted table,html[data-mc-theme] #assignments-weighted table,html[data-mc-theme] .summary{border-radius:var(--mc-shape-md)}html[data-mc-theme] #calendar-app,html[data-mc-theme] .calendar_header,html[data-mc-theme] #calendar_header{background:0 0}html[data-mc-theme] .fc,html[data-mc-theme] .fc-view,html[data-mc-theme] .fc table,html[data-mc-theme] .fc td,html[data-mc-theme] .fc th,html[data-mc-theme] .fc-unthemed td,html[data-mc-theme] .fc-unthemed th,html[data-mc-theme] .fc-unthemed .fc-divider,html[data-mc-theme] .fc-unthemed .fc-row,html[data-mc-theme] .fc-unthemed thead,html[data-mc-theme] .fc-unthemed tbody,html[data-mc-theme] .fc-unthemed .fc-content,html[data-mc-theme] .fc-unthemed .fc-popover{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .fc-day-header,html[data-mc-theme] .fc-unthemed th.fc-day-header{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface-variant);font-weight:500}html[data-mc-theme] .fc-unthemed td.fc-today,html[data-mc-theme] .fc .fc-today,html[data-mc-theme] .fc-state-highlight{background:color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent)}html[data-mc-theme] .fc-event{border-radius:var(--mc-shape-xs)}html[data-mc-theme] .fc-unthemed .fc-popover{background:var(--md-sys-color-surface-container);border-radius:var(--mc-shape-md);box-shadow:var(--mc-elev-2)}html[data-mc-theme] .mini_calendar,html[data-mc-theme] #minical{border-radius:var(--mc-shape-md);overflow:hidden}html[data-mc-theme] .mini_calendar .fc-today .fc-day-number,html[data-mc-theme] #minical .fc-today .fc-day-number{background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary);border-radius:var(--mc-shape-full)}html[data-mc-theme] .calendar_view_buttons .btn,html[data-mc-theme] #calendar_header .btn-group .btn{min-height:36px}html[data-mc-theme] .calendar_view_buttons .btn.active,html[data-mc-theme] .calendar_view_buttons .btn[aria-selected=true]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] #calendar-list-holder,html[data-mc-theme] #other-calendars-list-holder,html[data-mc-theme] #undated-events{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .event-details,html[data-mc-theme] .event-details-header,html[data-mc-theme] .event-details-content,html[data-mc-theme] .event-details-footer{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] #content.ic-Layout-contentMain .conversations,html[data-mc-theme] .messages,html[data-mc-theme] .message-detail,html[data-mc-theme] [data-testid=conversation],html[data-mc-theme] [data-testid=conversationListItem-Item]{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .roster,html[data-mc-theme] table.roster{border-radius:var(--mc-shape-md);overflow:hidden}html[data-mc-theme] .roster tbody tr:hover td{background:color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent)}html[data-mc-theme] .ic-avatar,html[data-mc-theme] .avatar{border-color:var(--md-sys-color-outline-variant)}html[data-mc-theme] .ic-Profile-layout,html[data-mc-theme] #profile_table,html[data-mc-theme] .profile_table,html[data-mc-theme] #content .ic-Table.profile_table{border-radius:var(--mc-shape-md)}html[data-mc-theme] .profileContent__Block,html[data-mc-theme] .profile_table th{color:var(--md-sys-color-on-surface-variant)}html[data-mc-theme] .notification-preferences [role=table],html[data-mc-theme] #notification-preferences{border-radius:var(--mc-shape-md)}html[data-mc-theme] .ic-Login{background:var(--md-sys-color-surface-container)}html[data-mc-theme] .ic-Login__content,html[data-mc-theme] .ic-Login-content__inner{background:var(--md-sys-color-surface-container-low);border-radius:var(--mc-shape-xl);box-shadow:var(--mc-elev-1)}";
	var files_default = "html[data-mc-theme] body.files #left-side #sticky-container{padding-top:72px}html[data-mc-theme] body.files .ef-header{background:0 0;border:none;align-items:center;gap:16px;padding:8px 0 20px;display:flex}html[data-mc-theme] body.files .ef-search-form{flex:0 420px;height:48px;margin:0;position:relative}html[data-mc-theme] body.files .ef-search-form .ic-Input{border-radius:var(--mc-shape-full);background:var(--md-sys-color-surface-container-high);width:100%;height:48px;box-shadow:none;border:none;padding:0 20px 0 52px;font-size:1rem}html[data-mc-theme] body.files .ef-search-form .ic-Input:hover{background:color-mix(in srgb, var(--md-sys-color-surface-container-high), var(--md-sys-color-on-surface) var(--mc-hover))}html[data-mc-theme] body.files .ef-search-form .ic-Input:focus{background:var(--md-sys-color-surface-container-highest);box-shadow:0 0 0 2px var(--md-sys-color-primary)}html[data-mc-theme] body.files .ef-search-form .Button{border-radius:var(--mc-shape-full);width:40px;height:40px;min-height:40px;color:var(--md-sys-color-on-surface-variant);background:0 0;border:none;place-items:center;padding:0;display:grid;position:absolute;top:4px;left:4px}html[data-mc-theme] body.files .ef-search-form .Button:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent)}html[data-mc-theme] body.files .ef-header__secondary{flex:1;justify-content:flex-end;align-items:center;gap:8px;display:flex}html[data-mc-theme] body.files .ef-selected-count{color:var(--md-sys-color-on-surface-variant);border-radius:var(--mc-shape-sm);background:var(--md-sys-color-surface-container);padding:6px 12px;font-size:.875rem;font-weight:500}html[data-mc-theme] body.files .ef-header__secondary .btn,html[data-mc-theme] body.files .ef-header__secondary .Button{min-height:40px}html[data-mc-theme] body.files .ef-main{border:none;align-items:flex-start;gap:20px;display:flex}html[data-mc-theme] body.files .ef-folder-content{border:none;flex:0 0 240px;width:240px;display:block;position:sticky;top:16px;overflow:visible;height:auto!important}html[data-mc-theme] body.files .ef-folder-list{border-radius:var(--mc-shape-lg);background:var(--md-sys-color-surface-container-low);border:none;flex:none;width:auto;min-height:0;max-height:calc(100vh - 32px);padding:12px 8px;overflow:auto;height:auto!important}html[data-mc-theme] body.files .ef-folder-list>div{height:auto!important}html[data-mc-theme] body.files .ef-folder-list:before{content:\"文件夹\";color:var(--md-sys-color-on-surface-variant);padding:4px 12px 12px;font-size:.875rem;font-weight:500;display:block}html[data-mc-theme] body.files .ef-folder-list ul.tree,html[data-mc-theme] body.files .ef-folder-list .treeContents{width:auto}html[data-mc-theme] body.files .ef-folder-list .treeLabel{border-radius:var(--mc-shape-full);width:auto;min-height:40px;color:var(--md-sys-color-on-surface-variant);align-items:center;gap:8px;padding:0 12px;font-weight:500;text-decoration:none;display:flex}html[data-mc-theme] body.files .ef-folder-list .treeLabel:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) var(--mc-hover), transparent);color:var(--md-sys-color-on-surface)}html[data-mc-theme] body.files .ef-folder-list .treeLabel span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}html[data-mc-theme] body.files .ef-folder-list .treeLabel i:before{color:inherit}html[data-mc-theme] body.files .ef-folder-list [aria-selected=true]>.treeLabel,html[data-mc-theme] body.files .ef-folder-list .treeLabel.selected,html[data-mc-theme] body.files .ef-folder-list .treeLabel:focus{outline:none;background:var(--md-sys-color-secondary-container)!important;color:var(--md-sys-color-on-secondary-container)!important}html[data-mc-theme] body.files .ef-folder-list .treeContents{padding-left:12px}html[data-mc-theme] body.files .ef-directory{border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--mc-shape-lg);background:0 0;flex:1;min-width:0;overflow:clip}html[data-mc-theme] body.files .ef-directory-header{border:none;border-bottom:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container);z-index:2;border-radius:0;align-items:center;min-height:48px;padding:0;display:flex;position:sticky;top:0}html[data-mc-theme] body.files .ef-directory-header [role=columnheader],html[data-mc-theme] body.files .ef-directory-header a.ef-plain-link{color:var(--md-sys-color-on-surface-variant);letter-spacing:.02em;font-size:.8125rem;font-weight:500;text-decoration:none}html[data-mc-theme] body.files .ef-directory-header .current-filter a.ef-plain-link,html[data-mc-theme] body.files .ef-directory-header .current-filter{color:var(--md-sys-color-on-surface)}html[data-mc-theme] body.files .ef-select-col{min-width:0;flex:0 0 16px!important;width:16px!important}html[data-mc-theme] body.files .ef-name-col{min-width:0;flex:auto!important;width:auto!important}html[data-mc-theme] body.files .ef-date-created-col,html[data-mc-theme] body.files .ef-date-modified-col{flex:0 0 120px;width:120px}html[data-mc-theme] body.files .ef-modified-by-col{flex:0 0 110px;width:110px}html[data-mc-theme] body.files .ef-size-col{text-align:end;flex:0 0 80px;width:80px;padding-inline-end:8px}html[data-mc-theme] body.files .ef-links-col{flex:0 0 64px;justify-content:flex-end;width:64px;display:flex}html[data-mc-theme] body.files .ef-links-col>div:first-child:empty{display:none}html[data-mc-theme] body.files .ef-item-row{border:none;border-bottom:1px solid color-mix(in srgb, var(--md-sys-color-outline-variant) 70%, transparent);min-height:64px;color:var(--md-sys-color-on-surface-variant);cursor:default;background:0 0;align-items:center;font-size:.875rem;display:flex}html[data-mc-theme] body.files .ef-item-row:last-child{border-bottom:none}html[data-mc-theme] body.files .ef-item-row:hover{background:color-mix(in srgb, var(--md-sys-color-on-surface) 5%, transparent)}html[data-mc-theme] body.files .ef-item-row.ef-item-selected,html[data-mc-theme] body.files .ef-item-row[aria-selected=true]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] body.files .ef-item-row a,html[data-mc-theme] body.files .ef-item-row .ef-modified-by-col a{color:inherit;text-decoration:none}html[data-mc-theme] body.files .ef-item-row .ef-modified-by-col a:hover{color:var(--md-sys-color-primary)}html[data-mc-theme] body.files .ef-name-col__link{align-items:center;gap:16px;min-width:0;padding-block:8px;display:flex}html[data-mc-theme] body.files .ef-name-col__text{color:var(--md-sys-color-on-surface);text-overflow:ellipsis;white-space:nowrap;font-size:.9375rem;font-weight:500;overflow:hidden}html[data-mc-theme] body.files .ef-name-col__link:hover .ef-name-col__text{color:var(--md-sys-color-primary);text-underline-offset:3px;text-decoration:underline}html[data-mc-theme] body.files .ef-big-icon-container{--tile:var(--md-sys-color-surface-container-highest);--ink:var(--md-sys-color-on-surface-variant);border-radius:var(--mc-shape-md);background:var(--tile);width:40px;height:40px;transition:transform var(--mc-dur) var(--mc-ease-spring), border-radius var(--mc-dur) var(--mc-ease);flex:none;place-items:center;display:grid}html[data-mc-theme] body.files .ef-item-row:hover .ef-big-icon-container{border-radius:var(--mc-shape-lg);transform:scale(1.06)}html[data-mc-theme] body.files .ef-big-icon{mix-blend-mode:multiply;margin:0;background-position:50%!important;background-repeat:no-repeat!important;background-size:contain!important;width:26px!important;height:26px!important}html[data-mc-theme] body.files .ef-big-icon-container{isolation:isolate}html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-pdf){--tile:var(--md-sys-color-error-container);--ink:var(--md-sys-color-on-error-container)}html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-ppt){--tile:var(--mc-warning-container);--ink:var(--mc-on-warning-container)}:is(html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-doc),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-text)){--tile:var(--mc-info-container);--ink:var(--mc-on-info-container)}html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-xls){--tile:var(--mc-success-container);--ink:var(--mc-on-success-container)}:is(html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-image),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-video),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-audio)){--tile:var(--md-sys-color-tertiary-container);--ink:var(--md-sys-color-on-tertiary-container)}:is(html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-folder),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-folder-locked)){--tile:var(--md-sys-color-primary-container);--ink:var(--md-sys-color-on-primary-container)}:is(html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-zip),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-code),html[data-mc-theme] body.files .ef-big-icon-container:has(.mimeClass-html)){--tile:var(--md-sys-color-secondary-container);--ink:var(--md-sys-color-on-secondary-container)}html[data-mc-theme] body.files .ef-big-icon-container img{object-fit:cover;border-radius:var(--mc-shape-md);width:40px;height:40px}html[data-mc-theme] body.files .ef-links-col .al-trigger{border-radius:var(--mc-shape-full);min-width:40px;min-height:40px;color:var(--md-sys-color-on-surface-variant)}@media (hover:hover){html[data-mc-theme] body.files .ef-item-row .ef-links-col .al-trigger{opacity:0;transition:opacity var(--mc-dur) var(--mc-ease)}html[data-mc-theme] body.files .ef-item-row:hover .ef-links-col .al-trigger,html[data-mc-theme] body.files .ef-item-row:focus-within .ef-links-col .al-trigger,html[data-mc-theme] body.files .ef-item-row.ef-item-selected .ef-links-col .al-trigger{opacity:1}}html[data-mc-theme] body.files .ef-usage-rights-col i:before,html[data-mc-theme] body.files .ef-links-col .published-status i:before{color:inherit}html[data-mc-theme] body.files .ef-empty-message,html[data-mc-theme] body.files .ef-directory .ef-empty-folder{text-align:center;color:var(--md-sys-color-on-surface-variant);padding:48px 16px}html[data-mc-theme] body.files .ef-footer{background:0 0;border:none;padding:16px 0}html[data-mc-theme] body.files .ef-footer a{border-radius:var(--mc-shape-full);min-height:40px;color:var(--md-sys-color-primary);align-items:center;padding:0 16px;font-weight:500;text-decoration:none;display:inline-flex}html[data-mc-theme] body.files .ef-footer a:hover{background:color-mix(in srgb, var(--md-sys-color-primary) var(--mc-hover), transparent)}html[data-mc-theme] body.files .ef-item-row{animation:mc-enter-up .26s var(--mc-ease-decel) backwards}html[data-mc-theme] body.files .ef-item-row:nth-child(4){animation-delay:20ms}html[data-mc-theme] body.files .ef-item-row:nth-child(5){animation-delay:40ms}html[data-mc-theme] body.files .ef-item-row:nth-child(6){animation-delay:60ms}html[data-mc-theme] body.files .ef-item-row:nth-child(7){animation-delay:80ms}html[data-mc-theme] body.files .ef-item-row:nth-child(n+8){animation-delay:.1s}@media (width<=1100px){html[data-mc-theme] body.files .ef-date-created-col,html[data-mc-theme] body.files .ef-modified-by-col{display:none}}html[data-mc-theme=dark] body.files .ef-big-icon{filter:invert();mix-blend-mode:screen}";
	var dark_default = "html[data-mc-theme=dark]{--mc-elev-1:0 1px 2px #00000080, 0 1px 3px 1px #0000004d;--mc-elev-2:0 1px 2px #00000080, 0 2px 6px 2px #0000004d;--mc-elev-3:0 1px 3px #00000080, 0 4px 8px 3px #0000004d}html[data-mc-theme=dark] .ic-DashboardCard{background:var(--md-sys-color-surface-container)}html[data-mc-theme=dark] .ic-DashboardCard__header_hero,html[data-mc-theme=dark] .planner-grouping a[class*=hero]{filter:brightness(.78)saturate(.85)}html[data-mc-theme=dark] .user_content img[src$=\\.svg],html[data-mc-theme=dark] .user_content img.equation_image,html[data-mc-theme=dark] img.equation_image{border-radius:var(--mc-shape-xs);background:#fff;padding:2px}html[data-mc-theme=dark] .MathJax,html[data-mc-theme=dark] mjx-container{color:var(--md-sys-color-on-surface)}html[data-mc-theme=dark] [class^=icon-]:before,html[data-mc-theme=dark] [class*=\\ icon-]:before{color:inherit}html[data-mc-theme=dark] .planner-empty-days svg,html[data-mc-theme=dark] .EmptyDays-styles__nothingPlanned svg{filter:brightness(.75)saturate(.8)}html[data-mc-theme=dark] iframe,html[data-mc-theme=dark] video,html[data-mc-theme=dark] .ef-file-preview-frame{--lightningcss-light:initial;--lightningcss-dark: ;color-scheme:light}html[data-mc-theme=dark] select option{background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface)}";
	var motion_default = "html[data-mc-theme] #content{animation:mc-enter-up .32s var(--mc-ease-decel) backwards}html[data-mc-theme] #right-side-wrapper{animation:mc-enter-up .32s var(--mc-ease-decel) 60ms backwards}html[data-mc-theme].mc-leaving #content,html[data-mc-theme].mc-leaving #right-side-wrapper{opacity:.45;transition:opacity .18s var(--mc-ease-accel), transform .18s var(--mc-ease-accel);pointer-events:none;animation:none;transform:translateY(-6px)}.mc-progress{z-index:2147483000;background:color-mix(in srgb, var(--md-sys-color-primary) 24%, transparent);opacity:0;height:4px;transition:opacity .15s var(--mc-ease,ease);pointer-events:none;position:fixed;inset:0 0 auto;overflow:hidden}html.mc-leaving .mc-progress{opacity:1}.mc-progress:before,.mc-progress:after{content:\"\";background:var(--md-sys-color-primary);border-radius:2px;position:absolute;inset:0 auto 0 0}html.mc-leaving .mc-progress:before{animation:2s cubic-bezier(.65,.815,.735,.395) infinite mc-progress-1}html.mc-leaving .mc-progress:after{animation:2s cubic-bezier(.165,.84,.44,1) 1.15s infinite mc-progress-2}@keyframes mc-progress-1{0%{left:-35%;right:100%}60%,to{left:100%;right:-90%}}@keyframes mc-progress-2{0%{left:-200%;right:100%}60%,to{left:107%;right:-8%}}@keyframes mc-fade-in{0%{opacity:0}}@keyframes mc-fade-out{to{opacity:0}}@keyframes mc-enter-up{0%{opacity:0;transform:translateY(16px)}}@keyframes mc-exit-up{to{opacity:0;transform:translateY(-8px)}}@keyframes mc-pop-in{0%{opacity:0;transform:scale(.92)}}@keyframes mc-drop-in{0%{opacity:0;transform:translateY(-8px)scaleY(.9)}}@keyframes mc-pill-grow{0%{background-size:30% 100%}}@keyframes mc-slide-in-left{0%{opacity:0;transform:translate(-24px)}}html[data-mc-theme] a,html[data-mc-theme] button,html[data-mc-theme] .btn,html[data-mc-theme] .Button,html[data-mc-theme] .ig-row,html[data-mc-theme] .ef-item-row,html[data-mc-theme] #section-tabs li.section a,html[data-mc-theme] .ic-app-header__menu-list-link,html[data-mc-theme] .ic-app-header__menu-list-link .menu-item-icon-container,html[data-mc-theme] .ic-app-header__menu-list-link svg,html[data-mc-theme] .ic-app-header__menu-list-link .menu-item__text,html[data-mc-theme] input,html[data-mc-theme] select,html[data-mc-theme] textarea{transition-property:background-color,color,border-color,box-shadow,transform,fill,opacity;transition-duration:var(--mc-dur);transition-timing-function:var(--mc-ease)}html[data-mc-theme] .btn:active,html[data-mc-theme] .Button:active,html[data-mc-theme] .button-sidebar-wide:active{transition-duration:80ms;transform:scale(.97)}html[data-mc-theme] .ic-app-header__menu-list-item--active .menu-item-icon-container{animation:mc-pill-grow var(--mc-dur-long) var(--mc-ease-spring) both}html[data-mc-theme] .ic-app-header__menu-list-link:active .menu-item-icon-container{transform:scale(.92)}html[data-mc-theme] .ic-app-header__menu-list-link:hover svg,html[data-mc-theme] .ic-app-header__menu-list-link:hover .mc-nav-img-icon{transform:translateY(-1px)}html[data-mc-theme] #section-tabs li.section a.active{animation:mc-pill-grow var(--mc-dur-long) var(--mc-ease-decel) both}html[data-mc-theme] .ic-DashboardCard{transition:box-shadow var(--mc-dur-medium) var(--mc-ease), transform var(--mc-dur-medium) var(--mc-ease)}html[data-mc-theme] .ic-DashboardCard:hover{transform:translateY(-3px)}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard,html[data-mc-theme] #context_modules>.context_module,html[data-mc-theme] #ag-list .item-group-condensed,html[data-mc-theme] .planner-day{animation:mc-enter-up .3s var(--mc-ease-decel) backwards}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(2),html[data-mc-theme] #context_modules>.context_module:nth-child(2),html[data-mc-theme] .planner-day:nth-child(2){animation-delay:25ms}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(3),html[data-mc-theme] #context_modules>.context_module:nth-child(3),html[data-mc-theme] .planner-day:nth-child(3){animation-delay:50ms}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(4),html[data-mc-theme] #context_modules>.context_module:nth-child(4),html[data-mc-theme] .planner-day:nth-child(4){animation-delay:75ms}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(5),html[data-mc-theme] #context_modules>.context_module:nth-child(5){animation-delay:.1s}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(6),html[data-mc-theme] #context_modules>.context_module:nth-child(6){animation-delay:.125s}html[data-mc-theme] .ic-DashboardCard__box>.ic-DashboardCard:nth-child(n+7),html[data-mc-theme] #context_modules>.context_module:nth-child(n+7){animation-delay:.15s}html[data-mc-theme] .ui-menu,html[data-mc-theme] .al-options,html[data-mc-theme] .dropdown-menu,html[data-mc-theme] .ui-autocomplete,html[data-mc-theme] .ui-kyle-menu{transform-origin:top;animation:mc-drop-in var(--mc-dur-medium) var(--mc-ease-decel)}html[data-mc-theme] .ui-dialog{animation:mc-pop-in var(--mc-dur-medium) var(--mc-ease-decel)}html[data-mc-theme] .ui-widget-overlay{animation:mc-fade-in var(--mc-dur-medium) var(--mc-ease)}html[data-mc-theme] #nav-tray-portal [role=dialog]{animation:mc-slide-in-left var(--mc-dur-long) var(--mc-ease-decel)}html[data-mc-theme] #flash_message_holder li{animation:mc-drop-in var(--mc-dur-medium) var(--mc-ease-decel)}html[data-mc-theme] .mc-ripple{pointer-events:none;background:currentColor;border-radius:50%;position:absolute;transform:scale(0)}@media (prefers-reduced-motion:reduce){html[data-mc-theme] *,html[data-mc-theme] :before,html[data-mc-theme] :after{transition-duration:1ms!important;animation-duration:1ms!important;animation-delay:0s!important}}";
	var isTop = window.top === window.self;
	var settings = loadSettings();
	var html = document.documentElement;
	var media = window.matchMedia("(prefers-color-scheme: dark)");
	var resolvedMode = (s) => s.mode === "system" ? media.matches ? "dark" : "light" : s.mode;
	var themeEl = null;
	var themeKey = "";
	function applyTheme(s) {
		const key = `${s.seed}|${s.contrast}`;
		if (key !== themeKey) {
			themeKey = key;
			const css = buildThemeCss(s.seed, s.contrast);
			if (themeEl) themeEl.textContent = css;
			else themeEl = addFixedStyle("theme", css);
		}
		if (s.enabled) {
			const mode = resolvedMode(s);
			html.setAttribute("data-mc-theme", mode);
			setDarkContent(mode === "dark", s.darkUserContent);
		} else {
			html.removeAttribute("data-mc-theme");
			setDarkContent(false, false);
		}
	}
	function apply(s) {
		const wasEnabled = settings.enabled;
		settings = s;
		saveSettings(s);
		applyTheme(s);
		if (s.enabled !== wasEnabled) setEnabled(s.enabled);
	}
	applyTheme(settings);
	addFixedStyle("styles", [
		tokens_default,
		base_default,
		components_default,
		layout_default,
		dashboard_default,
		course_default,
		tools_default,
		files_default,
		dark_default,
		motion_default
	].join("\n"));
	if (settings.enabled) {
		primeLogo();
		primeFromCache();
		startObserving();
		scheduleScan();
	} else {
		setEnabled(false);
		startObserving();
	}
	initMotion();
	window.addEventListener("load", () => setTimeout(refreshLogo, 500));
	media.addEventListener("change", () => settings.mode === "system" && applyTheme(settings));
	var open = () => openPanel(settings, apply);
	if (isTop) {
		_GM_registerMenuCommand("Materialized Canvas 设置", open);
		const mountNavButton = () => {
			const list = document.querySelector(".ic-app-header__secondary-navigation .ic-app-header__menu-list") ?? document.querySelector("#menu");
			if (!list || document.getElementById("mc-nav-settings")) return;
			const li = document.createElement("li");
			li.className = "menu-item ic-app-header__menu-list-item";
			li.innerHTML = `
      <button id="mc-nav-settings" class="ic-app-header__menu-list-link" type="button" title="外观设置">
        <div class="menu-item-icon-container" aria-hidden="true">
          <svg class="ic-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 22A10 10 0 0 1 2 12 10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5 0 .1.1.2.1.3.4.5.6 1 .6 1.6A2.4 2.4 0 0 1 12 22Zm0-18a8 8 0 0 0 0 16c.3 0 .5-.2.5-.5a.5.5 0 0 0-.1-.3c-.4-.5-.6-1-.6-1.7 0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>
        </div>
        <div class="menu-item__text">外观</div>
      </button>`;
			li.querySelector("button").addEventListener("click", open);
			list.prepend(li);
		};
		const upgradeToolIcons = () => {
			for (const img of document.querySelectorAll(".ic-app-header__menu-list-link > img")) {
				if (img.parentElement.querySelector(".mc-nav-icon-wrap")) continue;
				const wrap = document.createElement("div");
				wrap.className = "menu-item-icon-container mc-nav-icon-wrap";
				wrap.setAttribute("aria-hidden", "true");
				const icon = document.createElement("span");
				icon.className = "mc-nav-img-icon";
				icon.style.setProperty("--mc-icon", `url("${img.src.replace(/"/g, "%22")}")`);
				wrap.append(icon);
				img.after(wrap);
			}
		};
		const onReady = () => {
			mountNavButton();
			upgradeToolIcons();
		};
		if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
		else onReady();
	}
})();
