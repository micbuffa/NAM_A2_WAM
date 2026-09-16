/** @typedef { import('../../sdk-parammgr').ParamMgrNode } ParamMgrNode */
/* eslint-disable no-console */
/* eslint-disable no-mixed-operators */
/* eslint-disable no-plusplus */
/* eslint-disable no-underscore-dangle */
import CompositeAudioNode from './utils/sdk-parammgr/src/CompositeAudioNode.js';

// name is not so important here, the file Node.js is imported by the main plugin file (index.js)
export default class TunerNode extends CompositeAudioNode {
	/**
	 * @type {ParamMgrNode}
	 */
	_wamNode = undefined;

	/**
	 * @param {ParamMgrNode} wamNode
	 */
	// Mandatory.
	setup(wamNode) {
		this._wamNode = wamNode;
		this.connectInitialNodes();
	}

	constructor(context, options) {
		super(context, options);
		// Fix for Firefox: native AudioNode inheritance can lose the subclass prototype
		if (typeof this.createInitialNodes !== 'function') {
			Object.setPrototypeOf(this, TunerNode.prototype);
		}
		this.createInitialNodes();
	}

	/*  #########  Personnal code for the web audio graph  #########   */
	createInitialNodes() {
			//input
			this.inputNode = this.context.createGain();

			// pour test on met un oscillateur qui fait un LA 440
			// this.osc = this.context.createOscillator();
			// this.osc.frequency.value = 440;

			this.ampNode = this.context.createGain();
			this.ampNode.gain.value = 2;
	
			//analyser
			this.analyser = this.context.createAnalyser();
			this.analyser.fftSize = 2048;
			this.bufferLength = this.analyser.frequencyBinCount;
			this.dataArray = new Uint8Array(this.bufferLength);
	
			
		// mandatory, will create defaul input and output
		this.outputNode = this.context.createGain();
	}


	connectInitialNodes() {
		//connect the nodes
		this.connect(this.inputNode);
		this.inputNode.connect(this.analyser);
		this.analyser.connect(this.outputNode);

		//connect the osc to analyser
		//this.osc.connect(this.analyser);
		//this.osc.start();

		this._output =this.outputNode;
	}

	
	/**
	 * Tools to build sounds
	 */

	// MANDATORY : redefine these methods
	// eslint-disable-next-line class-methods-use-this
	getParamValue(name) {
		return this._wamNode.getParamValue(name);
	}
 
	setParamValue(name, value) {
		return this._wamNode.setParamValue(name, value);
	}

	getParamsValues() {
		return this._wamNode.getParamsValues();
	}

	setParamsValues(values) {
		return this._wamNode.setParamsValues(values);
	}

	
}
