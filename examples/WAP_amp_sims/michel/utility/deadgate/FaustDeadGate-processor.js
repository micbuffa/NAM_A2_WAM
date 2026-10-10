
/*
Code generated with Faust version 2.28.6
Compilation options: -lang wasm-ib -scal -ftz 2
*/

function getJSONFaustDeadGate() {
	return '{"name": "kpp_deadgate","filename": "FaustDeadGate.dsp","version": "2.28.6","compile_options": "-lang wasm-ib -scal -ftz 2","library_list": ["/usr/local/share/faust/stdfaust.lib","/usr/local/share/faust/filters.lib","/usr/local/share/faust/maths.lib","/usr/local/share/faust/platform.lib","/usr/local/share/faust/basics.lib","/usr/local/share/faust/analyzers.lib","/usr/local/share/faust/misceffects.lib","/usr/local/share/faust/signals.lib"],"include_pathnames": ["/usr/local/share/faust","/usr/local/share/faust","/usr/share/faust",".","/Documents/faust-github-master/Code-test/Michel Buffa/FaustDeadGate"],"size": 1188,"inputs": 2,"outputs": 2,"meta": [ { "analyzers.lib/name": "Faust Analyzer Library" },{ "analyzers.lib/version": "0.1" },{ "author": "Oleg Kapitonov" },{ "basics.lib/name": "Faust Basic Element Library" },{ "basics.lib/version": "0.1" },{ "filename": "FaustDeadGate.dsp" },{ "filters.lib/filterbank:author": "Julius O. Smith III" },{ "filters.lib/filterbank:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/filterbank:license": "MIT-style STK-4.3 license" },{ "filters.lib/fir:author": "Julius O. Smith III" },{ "filters.lib/fir:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/fir:license": "MIT-style STK-4.3 license" },{ "filters.lib/highpass:author": "Julius O. Smith III" },{ "filters.lib/highpass:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/highpass_plus_lowpass:author": "Julius O. Smith III" },{ "filters.lib/highpass_plus_lowpass:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/highpass_plus_lowpass:license": "MIT-style STK-4.3 license" },{ "filters.lib/iir:author": "Julius O. Smith III" },{ "filters.lib/iir:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/iir:license": "MIT-style STK-4.3 license" },{ "filters.lib/lowpass0_highpass1": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/lowpass0_highpass1:author": "Julius O. Smith III" },{ "filters.lib/lowpass:author": "Julius O. Smith III" },{ "filters.lib/lowpass:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/lowpass:license": "MIT-style STK-4.3 license" },{ "filters.lib/name": "Faust Filters Library" },{ "filters.lib/tf1:author": "Julius O. Smith III" },{ "filters.lib/tf1:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/tf1:license": "MIT-style STK-4.3 license" },{ "filters.lib/tf1s:author": "Julius O. Smith III" },{ "filters.lib/tf1s:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/tf1s:license": "MIT-style STK-4.3 license" },{ "filters.lib/tf2:author": "Julius O. Smith III" },{ "filters.lib/tf2:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/tf2:license": "MIT-style STK-4.3 license" },{ "filters.lib/tf2s:author": "Julius O. Smith III" },{ "filters.lib/tf2s:copyright": "Copyright (C) 2003-2019 by Julius O. Smith III <jos@ccrma.stanford.edu>" },{ "filters.lib/tf2s:license": "MIT-style STK-4.3 license" },{ "license": "GPLv3" },{ "maths.lib/author": "GRAME" },{ "maths.lib/copyright": "GRAME" },{ "maths.lib/license": "LGPL with exception" },{ "maths.lib/name": "Faust Math Library" },{ "maths.lib/version": "2.3" },{ "misceffects.lib/name": "Misc Effects Library" },{ "misceffects.lib/version": "2.0" },{ "name": "kpp_deadgate" },{ "platform.lib/name": "Generic Platform Library" },{ "platform.lib/version": "0.1" },{ "signals.lib/name": "Faust Signal Routing Library" },{ "signals.lib/version": "0.0" },{ "version": "0.1b" }],"ui": [ {"type": "vgroup","label": "kpp_deadgate","items": [ {"type": "vslider","label": "Dead Zone","address": "/kpp_deadgate/Dead_Zone","index": 44,"meta": [{ "style": "knob" }],"init": -100,"min": -120,"max": 0,"step": 0.001},{"type": "vslider","label": "Noise Gate","address": "/kpp_deadgate/Noise_Gate","index": 384,"meta": [{ "style": "knob" }],"init": -120,"min": -120,"max": 0,"step": 0.001}]}]}';
}
function getBase64CodeFaustDeadGate() { return "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aW9ucyI6ICItbGFuZyB3YXNtLWliIC1zY2FsIC1mdHogMiIsImxpYnJhcnlfbGlzdCI6IFsiL3Vzci9sb2NhbC9zaGFyZS9mYXVzdC9zdGRmYXVzdC5saWIiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0L2ZpbHRlcnMubGliIiwiL3Vzci9sb2NhbC9zaGFyZS9mYXVzdC9tYXRocy5saWIiLCIvdXNyL2xvY2FsL3NoYXJlL2ZhdXN0L3BsYXRmb3JtLmxpYiIsIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QvYmFzaWNzLmxpYiIsIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QvYW5hbHl6ZXJzLmxpYiIsIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QvbWlzY2VmZmVjdHMubGliIiwiL3Vzci9sb2NhbC9zaGFyZS9mYXVzdC9zaWduYWxzLmxpYiJdLCJpbmNsdWRlX3BhdGhuYW1lcyI6IFsiL3Vzci9sb2NhbC9zaGFyZS9mYXVzdCIsIi91c3IvbG9jYWwvc2hhcmUvZmF1c3QiLCIvdXNyL3NoYXJlL2ZhdXN0IiwiLiIsIi9Eb2N1bWVudHMvZmF1c3QtZ2l0aHViLW1hc3Rlci9Db2RlLXRlc3QvTWljaGVsIEJ1ZmZhL0ZhdXN0RGVhZEdhdGUiXSwic2l6ZSI6IDExODgsImlucHV0cyI6IDIsIm91dHB1dHMiOiAyLCJtZXRhIjogWyB7ICJhbmFseXplcnMubGliL25hbWUiOiAiRmF1c3QgQW5hbHl6ZXIgTGlicmFyeSIgfSx7ICJhbmFseXplcnMubGliL3ZlcnNpb24iOiAiMC4xIiB9LHsgImF1dGhvciI6ICJPbGVnIEthcGl0b25vdiIgfSx7ICJiYXNpY3MubGliL25hbWUiOiAiRmF1c3QgQmFzaWMgRWxlbWVudCBMaWJyYXJ5IiB9LHsgImJhc2ljcy5saWIvdmVyc2lvbiI6ICIwLjEiIH0seyAiZmlsZW5hbWUiOiAiRmF1c3REZWFkR2F0ZS5kc3AiIH0seyAiZmlsdGVycy5saWIvZmlsdGVyYmFuazphdXRob3IiOiAiSnVsaXVzIE8uIFNtaXRoIElJSSIgfSx7ICJmaWx0ZXJzLmxpYi9maWx0ZXJiYW5rOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi9maWx0ZXJiYW5rOmxpY2Vuc2UiOiAiTUlULXN0eWxlIFNUSy00LjMgbGljZW5zZSIgfSx7ICJmaWx0ZXJzLmxpYi9maXI6YXV0aG9yIjogIkp1bGl1cyBPLiBTbWl0aCBJSUkiIH0seyAiZmlsdGVycy5saWIvZmlyOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi9maXI6bGljZW5zZSI6ICJNSVQtc3R5bGUgU1RLLTQuMyBsaWNlbnNlIiB9LHsgImZpbHRlcnMubGliL2hpZ2hwYXNzOmF1dGhvciI6ICJKdWxpdXMgTy4gU21pdGggSUlJIiB9LHsgImZpbHRlcnMubGliL2hpZ2hwYXNzOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi9oaWdocGFzc19wbHVzX2xvd3Bhc3M6YXV0aG9yIjogIkp1bGl1cyBPLiBTbWl0aCBJSUkiIH0seyAiZmlsdGVycy5saWIvaGlnaHBhc3NfcGx1c19sb3dwYXNzOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi9oaWdocGFzc19wbHVzX2xvd3Bhc3M6bGljZW5zZSI6ICJNSVQtc3R5bGUgU1RLLTQuMyBsaWNlbnNlIiB9LHsgImZpbHRlcnMubGliL2lpcjphdXRob3IiOiAiSnVsaXVzIE8uIFNtaXRoIElJSSIgfSx7ICJmaWx0ZXJzLmxpYi9paXI6Y29weXJpZ2h0IjogIkNvcHlyaWdodCAoQykgMjAwMy0yMDE5IGJ5IEp1bGl1cyBPLiBTbWl0aCBJSUkgPGpvc0BjY3JtYS5zdGFuZm9yZC5lZHU+IiB9LHsgImZpbHRlcnMubGliL2lpcjpsaWNlbnNlIjogIk1JVC1zdHlsZSBTVEstNC4zIGxpY2Vuc2UiIH0seyAiZmlsdGVycy5saWIvbG93cGFzczBfaGlnaHBhc3MxIjogIkNvcHlyaWdodCAoQykgMjAwMy0yMDE5IGJ5IEp1bGl1cyBPLiBTbWl0aCBJSUkgPGpvc0BjY3JtYS5zdGFuZm9yZC5lZHU+IiB9LHsgImZpbHRlcnMubGliL2xvd3Bhc3MwX2hpZ2hwYXNzMTphdXRob3IiOiAiSnVsaXVzIE8uIFNtaXRoIElJSSIgfSx7ICJmaWx0ZXJzLmxpYi9sb3dwYXNzOmF1dGhvciI6ICJKdWxpdXMgTy4gU21pdGggSUlJIiB9LHsgImZpbHRlcnMubGliL2xvd3Bhc3M6Y29weXJpZ2h0IjogIkNvcHlyaWdodCAoQykgMjAwMy0yMDE5IGJ5IEp1bGl1cyBPLiBTbWl0aCBJSUkgPGpvc0BjY3JtYS5zdGFuZm9yZC5lZHU+IiB9LHsgImZpbHRlcnMubGliL2xvd3Bhc3M6bGljZW5zZSI6ICJNSVQtc3R5bGUgU1RLLTQuMyBsaWNlbnNlIiB9LHsgImZpbHRlcnMubGliL25hbWUiOiAiRmF1c3QgRmlsdGVycyBMaWJyYXJ5IiB9LHsgImZpbHRlcnMubGliL3RmMTphdXRob3IiOiAiSnVsaXVzIE8uIFNtaXRoIElJSSIgfSx7ICJmaWx0ZXJzLmxpYi90ZjE6Y29weXJpZ2h0IjogIkNvcHlyaWdodCAoQykgMjAwMy0yMDE5IGJ5IEp1bGl1cyBPLiBTbWl0aCBJSUkgPGpvc0BjY3JtYS5zdGFuZm9yZC5lZHU+IiB9LHsgImZpbHRlcnMubGliL3RmMTpsaWNlbnNlIjogIk1JVC1zdHlsZSBTVEstNC4zIGxpY2Vuc2UiIH0seyAiZmlsdGVycy5saWIvdGYxczphdXRob3IiOiAiSnVsaXVzIE8uIFNtaXRoIElJSSIgfSx7ICJmaWx0ZXJzLmxpYi90ZjFzOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi90ZjFzOmxpY2Vuc2UiOiAiTUlULXN0eWxlIFNUSy00LjMgbGljZW5zZSIgfSx7ICJmaWx0ZXJzLmxpYi90ZjI6YXV0aG9yIjogIkp1bGl1cyBPLiBTbWl0aCBJSUkiIH0seyAiZmlsdGVycy5saWIvdGYyOmNvcHlyaWdodCI6ICJDb3B5cmlnaHQgKEMpIDIwMDMtMjAxOSBieSBKdWxpdXMgTy4gU21pdGggSUlJIDxqb3NAY2NybWEuc3RhbmZvcmQuZWR1PiIgfSx7ICJmaWx0ZXJzLmxpYi90ZjI6bGljZW5zZSI6ICJNSVQtc3R5bGUgU1RLLTQuMyBsaWNlbnNlIiB9LHsgImZpbHRlcnMubGliL3RmMnM6YXV0aG9yIjogIkp1bGl1cyBPLiBTbWl0aCBJSUkiIH0seyAiZmlsdGVycy5saWIvdGYyczpjb3B5cmlnaHQiOiAiQ29weXJpZ2h0IChDKSAyMDAzLTIwMTkgYnkgSnVsaXVzIE8uIFNtaXRoIElJSSA8am9zQGNjcm1hLnN0YW5mb3JkLmVkdT4iIH0seyAiZmlsdGVycy5saWIvdGYyczpsaWNlbnNlIjogIk1JVC1zdHlsZSBTVEstNC4zIGxpY2Vuc2UiIH0seyAibGljZW5zZSI6ICJHUEx2MyIgfSx7ICJtYXRocy5saWIvYXV0aG9yIjogIkdSQU1FIiB9LHsgIm1hdGhzLmxpYi9jb3B5cmlnaHQiOiAiR1JBTUUiIH0seyAibWF0aHMubGliL2xpY2Vuc2UiOiAiTEdQTCB3aXRoIGV4Y2VwdGlvbiIgfSx7ICJtYXRocy5saWIvbmFtZSI6ICJGYXVzdCBNYXRoIExpYnJhcnkiIH0seyAibWF0aHMubGliL3ZlcnNpb24iOiAiMi4zIiB9LHsgIm1pc2NlZmZlY3RzLmxpYi9uYW1lIjogIk1pc2MgRWZmZWN0cyBMaWJyYXJ5IiB9LHsgIm1pc2NlZmZlY3RzLmxpYi92ZXJzaW9uIjogIjIuMCIgfSx7ICJuYW1lIjogImtwcF9kZWFkZ2F0ZSIgfSx7ICJwbGF0Zm9ybS5saWIvbmFtZSI6ICJHZW5lcmljIFBsYXRmb3JtIExpYnJhcnkiIH0seyAicGxhdGZvcm0ubGliL3ZlcnNpb24iOiAiMC4xIiB9LHsgInNpZ25hbHMubGliL25hbWUiOiAiRmF1c3QgU2lnbmFsIFJvdXRpbmcgTGlicmFyeSIgfSx7ICJzaWduYWxzLmxpYi92ZXJzaW9uIjogIjAuMCIgfSx7ICJ2ZXJzaW9uIjogIjAuMWIiIH1dLCJ1aSI6IFsgeyJ0eXBlIjogInZncm91cCIsImxhYmVsIjogImtwcF9kZWFkZ2F0ZSIsIml0ZW1zIjogWyB7InR5cGUiOiAidnNsaWRlciIsImxhYmVsIjogIkRlYWQgWm9uZSIsImFkZHJlc3MiOiAiL2twcF9kZWFkZ2F0ZS9EZWFkX1pvbmUiLCJpbmRleCI6IDQ0LCJtZXRhIjogW3sgInN0eWxlIjogImtub2IiIH1dLCJpbml0IjogLTEwMCwibWluIjogLTEyMCwibWF4IjogMCwic3RlcCI6IDAuMDAxfSx7InR5cGUiOiAidnNsaWRlciIsImxhYmVsIjogIk5vaXNlIEdhdGUiLCJhZGRyZXNzIjogIi9rcHBfZGVhZGdhdGUvTm9pc2VfR2F0ZSIsImluZGV4IjogMzg0LCJtZXRhIjogW3sgInN0eWxlIjogImtub2IiIH1dLCJpbml0IjogLTEyMCwibWluIjogLTEyMCwibWF4IjogMCwic3RlcCI6IDAuMDAxfV19XX0="; }

/*
 faust2wasm: GRAME 2017-2019
*/
 
'use strict';

// Monophonic Faust DSP
class FaustDeadGateProcessor extends AudioWorkletProcessor {
    
    // JSON parsing functions
    static parse_ui(ui, obj, callback)
    {
        for (var i = 0; i < ui.length; i++) {
            FaustDeadGateProcessor.parse_group(ui[i], obj, callback);
        }
    }
    
    static parse_group(group, obj, callback)
    {
        if (group.items) {
            FaustDeadGateProcessor.parse_items(group.items, obj, callback);
        }
    }
    
    static parse_items(items, obj, callback)
    {
        for (var i = 0; i < items.length; i++) {
            callback(items[i], obj, callback);
        }
    }
    
    static parse_item1(item, obj, callback)
    {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            FaustDeadGateProcessor.parse_items(item.items, obj, callback);
        } else if (item.type === "hbargraph"
                   || item.type === "vbargraph") {
            // Nothing
        } else if (item.type === "vslider"
                   || item.type === "hslider"
                   || item.type === "button"
                   || item.type === "checkbox"
                   || item.type === "nentry") {
            obj.push({ name: item.address,
                     defaultValue: item.init,
                     minValue: item.min,
                     maxValue: item.max });
        }
    }
    
    static parse_item2(item, obj, callback)
    {
        if (item.type === "vgroup"
            || item.type === "hgroup"
            || item.type === "tgroup") {
            FaustDeadGateProcessor.parse_items(item.items, obj, callback);
        } else if (item.type === "hbargraph"
                   || item.type === "vbargraph") {
            // Keep bargraph adresses
            obj.outputs_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        } else if (item.type === "soundfile") {
            // Keep soundfile adresses
            obj.soundfile_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        } else if (item.type === "vslider"
                   || item.type === "hslider"
                   || item.type === "button"
                   || item.type === "checkbox"
                   || item.type === "nentry") {
            // Keep inputs adresses
            obj.inputs_items.push(item.address);
            obj.pathTable[item.address] = parseInt(item.index);
        }
    }
 
    static get parameterDescriptors() 
    {
        // Analyse JSON to generate AudioParam parameters
        var params = [];
        FaustDeadGateProcessor.parse_ui(JSON.parse(getJSONFaustDeadGate()).ui, params, FaustDeadGateProcessor.parse_item1);
 	    return params;
    }
   
    constructor(options)
    {
        super(options);
        this.running = true;
        
       	const importObject = {
                env: {
                    memoryBase: 0,
                    tableBase: 0,

                    // Integer version
                    _abs: Math.abs,

                    // Float version
                    _acosf: Math.acos,
                    _asinf: Math.asin,
                    _atanf: Math.atan,
                    _atan2f: Math.atan2,
                    _ceilf: Math.ceil,
                    _cosf: Math.cos,
                    _expf: Math.exp,
                    _floorf: Math.floor,
                    _fmodf: function(x, y) { return x % y; },
                    _logf: Math.log,
                    _log10f: Math.log10,
                    _max_f: Math.max,
                    _min_f: Math.min,
                    _remainderf: function(x, y) { return x - Math.round(x/y) * y; },
                    _powf: Math.pow,
                    _roundf: Math.fround,
                    _sinf: Math.sin,
                    _sqrtf: Math.sqrt,
                    _tanf: Math.tan,
                    _acoshf: Math.acosh,
                    _asinhf: Math.asinh,
                    _atanhf: Math.atanh,
                    _coshf: Math.cosh,
                    _sinhf: Math.sinh,
                    _tanhf: Math.tanh,

                    // Double version
                    _acos: Math.acos,
                    _asin: Math.asin,
                    _atan: Math.atan,
                    _atan2: Math.atan2,
                    _ceil: Math.ceil,
                    _cos: Math.cos,
                    _exp: Math.exp,
                    _floor: Math.floor,
                    _fmod: function(x, y) { return x % y; },
                    _log: Math.log,
                    _log10: Math.log10,
                    _max_: Math.max,
                    _min_: Math.min,
                    _remainder:function(x, y) { return x - Math.round(x/y) * y; },
                    _pow: Math.pow,
                    _round: Math.fround,
                    _sin: Math.sin,
                    _sqrt: Math.sqrt,
                    _tan: Math.tan,
                    _acosh: Math.acosh,
                    _asinh: Math.asinh,
                    _atanh: Math.atanh,
                    _cosh: Math.cosh,
                    _sinh: Math.sinh,
                    _tanh: Math.tanh,

                    table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
                }
        };
        
        this.FaustDeadGate_instance = new WebAssembly.Instance(options.processorOptions.wasm_module, importObject);
        this.json_object = JSON.parse(options.processorOptions.json);
     
        this.output_handler = function(path, value) { this.port.postMessage({ path: path, value: value }); };
        
        this.ins = null;
        this.outs = null;

        this.dspInChannnels = [];
        this.dspOutChannnels = [];

        this.numIn = parseInt(this.json_object.inputs);
        this.numOut = parseInt(this.json_object.outputs);

        // Memory allocator
        this.ptr_size = 4;
        this.sample_size = 4;
        this.integer_size = 4;
        
        this.factory = this.FaustDeadGate_instance.exports;
        this.HEAP = this.FaustDeadGate_instance.exports.memory.buffer;
        this.HEAP32 = new Int32Array(this.HEAP);
        this.HEAPF32 = new Float32Array(this.HEAP);

        // Warning: keeps a ref on HEAP in Chrome and prevent proper GC
        //console.log(this.HEAP);
        //console.log(this.HEAP32);
        //console.log(this.HEAPF32);

        // bargraph
        this.outputs_timer = 5;
        this.outputs_items = [];

        // input items
        this.inputs_items = [];
        
        // soundfile items
        this.soundfile_items = [];

        // Start of HEAP index

        // DSP is placed first with index 0. Audio buffer start at the end of DSP.
        this.audio_heap_ptr = parseInt(this.json_object.size);

        // Setup pointers offset
        this.audio_heap_ptr_inputs = this.audio_heap_ptr;
        this.audio_heap_ptr_outputs = this.audio_heap_ptr_inputs + (this.numIn * this.ptr_size);

        // Setup buffer offset
        this.audio_heap_inputs = this.audio_heap_ptr_outputs + (this.numOut * this.ptr_size);
        this.audio_heap_outputs = this.audio_heap_inputs + (this.numIn * NUM_FRAMES * this.sample_size);
        
        // Start of DSP memory : DSP is placed first with index 0
        this.dsp = 0;

        this.pathTable = [];
     
        // Send output values to the AudioNode
        this.update_outputs = function ()
        {
            if (this.outputs_items.length > 0 && this.output_handler && this.outputs_timer-- === 0) {
                this.outputs_timer = 5;
                for (var i = 0; i < this.outputs_items.length; i++) {
                    this.output_handler(this.outputs_items[i], this.HEAPF32[this.pathTable[this.outputs_items[i]] >> 2]);
                }
            }
        }
        
        this.initAux = function ()
        {
            var i;
            
            if (this.numIn > 0) {
                this.ins = this.audio_heap_ptr_inputs;
                for (i = 0; i < this.numIn; i++) {
                    this.HEAP32[(this.ins >> 2) + i] = this.audio_heap_inputs + ((NUM_FRAMES * this.sample_size) * i);
                }
                
                // Prepare Ins buffer tables
                var dspInChans = this.HEAP32.subarray(this.ins >> 2, (this.ins + this.numIn * this.ptr_size) >> 2);
                for (i = 0; i < this.numIn; i++) {
                    this.dspInChannnels[i] = this.HEAPF32.subarray(dspInChans[i] >> 2, (dspInChans[i] + NUM_FRAMES * this.sample_size) >> 2);
                }
            }
            
            if (this.numOut > 0) {
                this.outs = this.audio_heap_ptr_outputs;
                for (i = 0; i < this.numOut; i++) {
                    this.HEAP32[(this.outs >> 2) + i] = this.audio_heap_outputs + ((NUM_FRAMES * this.sample_size) * i);
                }
                
                // Prepare Out buffer tables
                var dspOutChans = this.HEAP32.subarray(this.outs >> 2, (this.outs + this.numOut * this.ptr_size) >> 2);
                for (i = 0; i < this.numOut; i++) {
                    this.dspOutChannnels[i] = this.HEAPF32.subarray(dspOutChans[i] >> 2, (dspOutChans[i] + NUM_FRAMES * this.sample_size) >> 2);
                }
            }
            
            // Parse UI
            FaustDeadGateProcessor.parse_ui(this.json_object.ui, this, FaustDeadGateProcessor.parse_item2);
                 
            // Init DSP
            this.factory.init(this.dsp, sampleRate); // 'sampleRate' is defined in AudioWorkletGlobalScope  
        }

        this.setParamValue = function (path, val)
        {
            this.HEAPF32[this.pathTable[path] >> 2] = val;
        }

        this.getParamValue = function (path)
        {
            return this.HEAPF32[this.pathTable[path] >> 2];
        }

        // Init resulting DSP
        this.initAux();
        console.log(this);
    }
    
    handleMessage(event)
    {
        var msg = event.data;
        switch (msg.type) {
            case "destroy": this.running = false; break;
        }
    }
    
    process(inputs, outputs, parameters) 
    {
        var input = inputs[0];
        var output = outputs[0];
        
        // Check inputs
        if (this.numIn > 0 && (!input || !input[0] || input[0].length === 0)) {
            //console.log("Process input error");
            return true;
        }
        // Check outputs
        if (this.numOut > 0 && (!output || !output[0] || output[0].length === 0)) {
            //console.log("Process output error");
            return true;
        }
        
        // Copy inputs
        if (input !== undefined) {
            for (var chan = 0; chan < Math.min(this.numIn, input.length); ++chan) {
                var dspInput = this.dspInChannnels[chan];
                dspInput.set(input[chan]);
            }
        }
        
        /*
        TODO: sample accurate control change is not yet handled
        When no automation occurs, params[i][1] has a length of 1,
        otherwise params[i][1] has a length of NUM_FRAMES with possible control change each sample
    	*/
        
        // Update controls
        for (const path in parameters) {
            const paramArray = parameters[path];
            this.setParamValue(path, paramArray[0]);
        }
        
        // Compute
        try {
            this.factory.compute(this.dsp, NUM_FRAMES, this.ins, this.outs);
        } catch(e) {
            console.log("ERROR in compute (" + e + ")");
        }
        
        // Update bargraph
        this.update_outputs();
        
        // Copy outputs
        if (output !== undefined) {
            for (var chan = 0; chan < Math.min(this.numOut, output.length); ++chan) {
                var dspOutput = this.dspOutChannnels[chan];
                output[chan].set(dspOutput);
            }
        }
        
        return this.running;
    }
}

// Globals
const NUM_FRAMES = 128;
try {
    registerProcessor('FaustDeadGate', FaustDeadGateProcessor);
} catch (error) {
    console.warn(error);
}
