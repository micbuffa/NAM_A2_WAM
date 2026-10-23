// https://github.com/g200kg/webaudio-controls/blob/master/webaudio-controls.js
import '../utils/webaudio-controls.js';


let style = `
:host {
    background: linear-gradient(135deg, #111, #222);
    background-image: 
        radial-gradient(ellipse at center, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 60%),
        repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.5) 5px, rgba(0,0,0,0.5) 10px);
    box-shadow: 
        inset 0 1px 2px rgba(255,255,255,0.1),
        0 8px 16px rgba(0,0,0,0.8),
        0 0 10px rgba(0,0,0,0.9);
    border: 1px solid #000;
    width: 200px;
    height: 300px;
    display: block;
    user-select: none;
    cursor: move;
    z-index: 9;
    border-radius: 10px;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    position: relative;
    overflow: hidden;
}

.bezel {
    position: absolute;
    top: 5px; left: 5px; right: 5px; bottom: 5px;
    border: 2px solid #333;
    border-radius: 8px;
    background: transparent;
    pointer-events: none;
}

.title {
    text-align: center;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-size: 14px;
    font-weight: bold;
    margin-top: 15px;
    text-shadow: 0 -1px 1px #000;
}

.plugin-name {
    text-align: center;
    color: #444;
    font-size: 10px;
    font-weight: bold;
    letter-spacing: 1px;
    margin-top: 2px;
    text-shadow: 0 1px 0px rgba(255,255,255,0.1);
    transition: all 0.3s ease;
}

/* Bright glow when ON */
#wrapper:not(.off-state) .title {
    color: #fff;
    text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 15px rgba(255,255,255,0.4);
}
#wrapper:not(.off-state) .plugin-name {
    color: #aaa;
    text-shadow: 0 0 10px rgba(255,255,255,0.5);
}

.wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
}

#detector {
    width: 170px;
    height: 170px;
    border: 2px solid #000;
    border-radius: 8px;
    text-align: center;
    background: #151a15;
    box-shadow: inset 0 0 15px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.2);
    margin-top: 15px;
    position: relative;
    overflow: hidden;
}

.confident #pitch, .confident #note, .confident #detune_amt {
    color: #0f0;
    text-shadow: 0 0 5px #0f0, 0 0 10px #0f0;
}
.vague #pitch, .vague #note, .vague #detune_amt {
    color: #242;
}

/* Dimmed state when tuner is OFF */
.off-state #detector {
    background: #080a08;
    opacity: 0.6;
}
.off-state #pitch, .off-state #note, .off-state #detune, .off-state #detune_amt, .off-state #pitch_unit {
    color: #1a1a1a !important;
    text-shadow: none !important;
    opacity: 0.3;
}

.pitch {
    font-size: 18px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    position: absolute;
    top: 38px;
    left: 10px;
    color: #242;
}

.note {
    font-size: 36px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    position: absolute;
    top: 20px;
    right: 15px;
    color: #242;
}

#detune {
    position: absolute;
    bottom: 4px;
    width: 100%;
    text-align: center;
    font-size: 10px;
    color: #242;
    font-family: 'Courier New', monospace;
}

.flat #flat { color: #f00; text-shadow: 0 0 5px #f00; display: inline;}
.sharp #sharp { color: #f00; text-shadow: 0 0 5px #f00; display: inline;}
#flat, #sharp { display: none; }

#diode {
    position: absolute;
    top: 5px;
    left: 0;
    width: 170px;
    height: 20px;
}

#output {
    position: absolute;
    bottom: 15px;
    left: 0;
    width: 170px;
    height: 90px;
}

.controls {
    margin-top: 15px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
}

.power-label {
    color: #ccc;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: bold;
    text-shadow: 0 -1px 1px #000;
}
`;

let template = `
<div class="bezel"></div>
<div id="wrapper" class="wrapper">
    <div class="title">Pro Tuner</div>
    <div class="plugin-name">Chromatic</div>
    
    <div id="detector" class="vague">
        <canvas id="diode" width="170" height="20"></canvas>
        <div class="pitch"><span id="pitch">--</span><span id="pitch_unit" style="font-size:10px; margin-left:2px; color:inherit;">Hz</span></div>
        <div class="note" id="note">-</div>
        <canvas id="output" width="170" height="90"></canvas>
        
        <div id="detune">
            <span id="flat">&lt;</span> <span id="detune_label">FLAT</span> <span id="detune_amt">--</span> <span id="sharp">&gt;</span> <span id="cents_label">CENTS</span>
        </div>
    </div>
    
    <div class="controls">
        <webaudio-switch id="switch1" class="switch" midilearn="true"
            src="./assets/switch_1.png" width="32" height="20">
        </webaudio-switch>
        <div class="power-label">POWER</div>
    </div>
</div>
`;

const getAssetUrl = (asset) => {
    const base = new URL('.', import.meta.url);
    return `${base}${asset}`;
};

//let tunertemp = document.currentScript.ownerDocument.querySelector("#wc-tuner");
export default class TunerHTMLElement extends HTMLElement {

    constructor(plug) {
        super();

        this.plugin = plug;

        this._plug = plug;
        this._plug.gui = this;
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${style}</style>${template}`;
        //this._root.appendChild(tunertemp.content.cloneNode(true));
        this.state = new Object();
        this.isOn;
        this.fixRelativePath();

        this.setSwitchListener();
        this._root = this.shadowRoot;
        this.wrapper = this._root.querySelector('#wrapper');
        this.detectorElem = this._root.querySelector('#detector');

        // Set initial visual state
        if (!this.isOn) {
            this.wrapper.classList.add('off-state');
        }
    }

    fixRelativePath() {
        const switchElem = this._root.querySelector("#switch1");
        const imgPath = switchElem.getAttribute("src");
        if (imgPath && imgPath.startsWith("./assets")) {
            const base = new URL('.', import.meta.url);
            switchElem.setAttribute("src", `${base}${imgPath}`);
        }
    }

    get properties() {
        this.boundingRect = {
            dataWidth: {
                type: Number,
                value: 200
            },
            dataHeight: {
                type: Number,
                value: 280
            }
        };
        return this.boundingRect;
    }

    static get observedAttributes() { return ['state']; }

    attributeChangedCallback() {
        this.state = JSON.parse(this.getAttribute('state'));
        console.log(this.state);
        try {
            if (this.state.status == "enable") {
                this._root.querySelector("#switch1").value = 1;
                this.isOn = true;
            }
        } catch (error) {
            console.log(error);
        }
    }

    connectedCallback() {
        this.canvasElem = this.shadowRoot.getElementById("output");
        this.detectorElem = this.shadowRoot.getElementById("detector");
        this.DEBUGCANVAS = this.shadowRoot.getElementById("waveform");

        // Removed freqslider logic

        this.wA = this.shadowRoot.getElementById("output").offsetWidth;
        this.hA = this.shadowRoot.getElementById("output").offsetHeight;

        this.outputACtx = this.canvasElem.getContext('2d');


        //canvas diode
        this.canvasdio = this.shadowRoot.getElementById("diode");
        this.outputDCtx = this.canvasdio.getContext('2d');

        //Tuner canvas
        this.pitchElem = this.shadowRoot.getElementById("pitch");
        this.noteElem = this.shadowRoot.getElementById("note");
        this.detuneElem = this.shadowRoot.getElementById("detune");
        this.detuneAmount = this.shadowRoot.getElementById("detune_amt");

        // for analysing frequencies
        this.buflen = 2048;
        this.buf = new Float32Array(this.buflen);
        this.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        this.MIN_SAMPLES = 0;
        this.GOOD_ENOUGH_CORRELATION = 0.9;

        //for function about mode choice
        this.toneLevel = 0;
        this.frequencyString = [0, 0, 0, 0, 0, 0]
        this.valueSaved = 0;

    }


    measurePitch() {
        this.rafID = requestAnimationFrame(this.updatePitch.bind(this));
    }

    stopMeasuringPitch() {
        cancelAnimationFrame(this.rafID);
    }

    setSwitchListener() {
        console.log("setSwitch");
        const { plugin } = this;
        console.log(this);
        //by default, plugin is disabled
        this.isOn = false;
        plugin.audioNode.setParamsValues({ enabled: 0 });

        this._root
            .querySelector('#switch1')
            .addEventListener('change', (evt) => {
                console.log(this.plugin);
                let tunerEnabled = this.plugin.audioNode.getParamValue('enabled');
                if (!tunerEnabled) {
                    // For starting the audio context in case it was stopped
                    this.plugin.audioNode.context.resume();

                    this.plugin.audioNode.setParamValue('enabled', 1);
                    this.isOn = true;
                    this.measurePitch();
                    this.updateDecorativeState(true);
                    console.log("Tuner is on");
                } else {
                    this.plugin.audioNode.setParamValue('enabled', 0);
                    this.isOn = false;
                    this.stopMeasuringPitch();
                    this.updateDecorativeState(false);
                    console.log("Tuner is off");
                }

            });
    }

    /** Light up / dim decorative LEDs on the diode bar when tuner is toggled */
    updateDecorativeState(on) {
        // Use the already-initialized canvas contexts from connectedCallback
        if (!this.outputDCtx || !this.outputACtx) return;

        // Toggle visual mode on the wrapper
        if (on) {
            this.wrapper.classList.remove('off-state');
        } else {
            this.wrapper.classList.add('off-state');
        }

        const ctx = this.outputDCtx;
        ctx.clearRect(0, 0, 170, 20);
        if (on) {
            // Ambient power-on glow: side LEDs light up in amber
            this.drawLED(ctx, 25,  10, 6, '#fa0', true);
            this.drawLED(ctx, 85,  10, 6, '#0f0', false);
            this.drawLED(ctx, 145, 10, 6, '#fa0', true);
        } else {
            // All LEDs dimmed
            this.initdiiode(ctx);
        }

        // Redraw the meter background so fine ticks appear/disappear
        this.outputACtx.clearRect(0, 0, this.wA, this.hA);
        this.background(this.outputACtx);

        if (on) {
            // Full bright needle at rest (angle 0)
            this.inittrait(this.outputACtx, 0);
        } else {
            // Dimmed needle at rest – draw manually with low opacity
            const ctx = this.outputACtx;
            ctx.save();
            ctx.translate(this.wA / 2, this.hA - 10);
            ctx.globalAlpha = 0.25;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(4, 0);
            ctx.lineTo(1.5, -78);
            ctx.lineTo(-1.5, -78);
            ctx.closePath();
            ctx.fill();
            // Pivot dimmed
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#333';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#555';
            ctx.stroke();
            ctx.restore();
        }
    }

    // name of the custom HTML element associated
    // with the plugin. Will appear in the DOM if
    // the plugin is visible
    static is() {
        return 'wasabi-tuner';
    }








    noteFromPitch(frequency) {
        var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
        return Math.round(noteNum) + 69;
    }

    centsOffFromPitch(frequency, note) {
        return Math.floor(1200 * Math.log(frequency / this.frequencyFromNoteNumber(note)) / Math.log(2));
    }

    frequencyFromNoteNumber(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    getAverageFrequency(arrayFrequencies) {
        let values = 0;
        let average;

        let length = arrayFrequencies.length;

        for (let i = 0; i < length; i++) {
            values += arrayFrequencies[i];
        }

        average = values / length;
        return average;
    }

    updatePitch() {
        // get frequency data from analyser
        this.plugin.audioNode.analyser.getByteFrequencyData(this.plugin.audioNode.dataArray);

        // calculate an average frequency for the data
        const averageFrequency = this.getAverageFrequency(this.plugin.audioNode.dataArray);
        var coordinateY = (averageFrequency);

        if (coordinateY < 0)
            coordinateY = 0;
        this.hRect = coordinateY;

        if (this.DEBUGCANVAS) {
            let waveCanvas = this.DEBUGCANVAS.getContext("2d");
            waveCanvas.strokeStyle = "black";
            waveCanvas.lineWidth = 1;
        }



        //canvas aiguille
        //le canvas de l'aiguille a été envelé pour le mettre dans le canvas principale


        if (!this.isOn) {
            // Force displays to dimmed state
            this.detectorElem.className = "vague";
            this.pitchElem.innerText = "--";
            this.noteElem.innerText = "-";
            this.detuneElem.className = "";
            this.detuneAmount.innerText = "--";
            
            // Clear meter and draw dimmed needle/background
            this.outputACtx.clearRect(0, 0, this.wA, this.hA);
            this.background(this.outputACtx); // draws dimmed background since this.isOn is false
            
            // Draw dimmed needle manually (reuse logic from updateDecorativeState)
            const ctx = this.outputACtx;
            ctx.save();
            ctx.translate(this.wA / 2, this.hA - 10);
            ctx.globalAlpha = 0.25;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#555';
            ctx.beginPath();
            ctx.moveTo(-4, 0);
            ctx.lineTo(4, 0);
            ctx.lineTo(1.5, -78);
            ctx.lineTo(-1.5, -78);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#333';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#555';
            ctx.stroke();
            ctx.restore();

            // Clear decorative diode LEDs
            this.initdiiode(this.outputDCtx);

            this.rafID = requestAnimationFrame(this.updatePitch.bind(this));
            return;
        }

        this.plugin.audioNode.analyser.getFloatTimeDomainData(this.buf);
        let ac = this.autoCorrelate(this.buf, this.plugin.audioNode.context.sampleRate);

        if (ac !== -1) {
            // Smoothing the pitch to stabilize the needle AND display
            // Using a more aggressive smoothing for the needle
            if (!this.smoothedPitch || Math.abs(this.smoothedPitch - ac) > 30) {
                this.smoothedPitch = ac;
            } else {
                // Stabilize: 0.1 for faster response, 0.05 for more stability
                const alpha = 0.08;
                this.smoothedPitch = this.smoothedPitch * (1 - alpha) + ac * alpha;
            }
        }

        let displayPitch = ac === -1 ? -1 : this.smoothedPitch;
        let newAngle = this.angle_frequence(displayPitch);

        this.outputACtx.clearRect(0, 0, this.wA, this.hA);

        this.background(this.outputACtx);
        this.inittrait(this.outputACtx, newAngle);

        this.initdiiode(this.outputDCtx, displayPitch);

        if (ac == -1) {
            this.detectorElem.className = "vague";
            this.pitchElem.innerText = "--";
            this.noteElem.innerText = "-";
            this.detuneElem.className = "";
            this.detuneAmount.innerText = "--";
        } else {
            this.detectorElem.className = "confident";

            let pitch = this.smoothedPitch;
            this.pitchElem.innerText = Math.round(pitch);
            let note = this.noteFromPitch(pitch);
            this.noteElem.innerHTML = this.noteStrings[note % 12];
            let detune = this.centsOffFromPitch(pitch, note);
            if (detune == 0) {
                this.detuneElem.className = "";
                this.detuneAmount.innerHTML = "--";
            } else {
                if (detune < 0)
                    this.detuneElem.className = "flat";
                else
                    this.detuneElem.className = "sharp";
                this.detuneAmount.innerHTML = Math.abs(detune);
            }
            this.Modifdio(this.outputDCtx, detune, this.detuneElem.className);
        }
        /* let freq = Math.round(ac);
         if (this.valueSaved != freq) {
             this.indicateTone(this.toneLevel);
         }*/

        // Se rappelle lui-même 60 fois par seconde
        this.rafID = requestAnimationFrame(this.updatePitch.bind(this));


    }

    background(ctx) {
        ctx.save();
        ctx.translate(this.wA / 2, this.hA - 10);

        // ── Helper: compute angle from a cent offset (same logic as main ticks) ──
        const tickAngle = (m, rightSide) => {
            let cnorm = this.map(m, -50, 0, 1, 0.1);
            cnorm = this.mapLinearToLog(cnorm, -0.1, -1, 0.1, 1);
            return this.map(cnorm, -1, -0.1, rightSide ? Math.PI / 3 : -Math.PI / 3, 0);
        };

        // ── Power-on: radial backlight glow behind the whole arc ──
        if (this.isOn) {
            ctx.save();
            const glowR = this.hA / 3 + 55;
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
            grd.addColorStop(0,   'rgba(0, 255, 80, 0.09)');
            grd.addColorStop(0.6, 'rgba(0, 200, 60, 0.05)');
            grd.addColorStop(1,   'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(0, 0, glowR, -Math.PI, 0);
            ctx.fill();
            ctx.restore();
        }

        // ── Tick drawing helpers ──
        var drawTick = (m, color, isMain) => {
            let angle = tickAngle(m, false);
            ctx.save();
            ctx.rotate(angle);
            ctx.strokeStyle = color;
            ctx.lineWidth = isMain ? 3 : 1.5;
            if (this.isOn && isMain) {
                ctx.shadowBlur = 6;
                ctx.shadowColor = color;
            }
            ctx.beginPath();
            ctx.moveTo(0, -this.hA / 3 - 35);
            ctx.lineTo(0, -this.hA / 3 - (isMain ? 50 : 42));
            ctx.stroke();
            ctx.restore();
        };

        var drawTickRight = (m, color, isMain) => {
            let angle = tickAngle(m, true);
            ctx.save();
            ctx.rotate(angle);
            ctx.strokeStyle = color;
            ctx.lineWidth = isMain ? 3 : 1.5;
            if (this.isOn && isMain) {
                ctx.shadowBlur = 6;
                ctx.shadowColor = color;
            }
            ctx.beginPath();
            ctx.moveTo(0, -this.hA / 3 - 35);
            ctx.lineTo(0, -this.hA / 3 - (isMain ? 50 : 42));
            ctx.stroke();
            ctx.restore();
        };

        // ── Fine ticks (every 1 cent) – LINEAR distribution to cover the full arc ──
        if (this.isOn) {
            for (let m = -49; m < 0; m++) {
                if (m % 5 === 0) continue; // main ticks handle these
                const color = m < -30 ? 'rgba(255,60,60,0.7)' : (m < -15 ? 'rgba(255,180,0,0.75)' : 'rgba(210,210,210,0.75)');
                // Simple linear mapping: m in [-50, 0] → angle in [±π/3, 0]
                const angleL = this.map(m, -50, 0, -Math.PI / 3, 0);   // left side
                const angleR = this.map(m, -50, 0,  Math.PI / 3, 0);   // right side (mirrored)
                const innerR = this.hA / 3 + 35;
                const outerR = this.hA / 3 + (m % 2 === 0 ? 43 : 40); // alternating for density

                ctx.save();
                ctx.rotate(angleL);
                ctx.strokeStyle = color;
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(0, -innerR);
                ctx.lineTo(0, -outerR);
                ctx.stroke();
                ctx.restore();

                ctx.save();
                ctx.rotate(angleR);
                ctx.strokeStyle = color;
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(0, -innerR);
                ctx.lineTo(0, -outerR);
                ctx.stroke();
                ctx.restore();
            }
        }

        // ── Center tick (always visible, brighter when ON) ──
        ctx.strokeStyle = this.isOn ? '#0f0' : '#0a0';
        ctx.lineWidth = 4;
        if (this.isOn) { ctx.shadowBlur = 10; ctx.shadowColor = '#0f0'; }
        ctx.beginPath();
        ctx.moveTo(0, -this.hA / 3 - 35);
        ctx.lineTo(0, -this.hA / 3 - 52);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Main ticks (every 5 cents) – always visible ──
        for (let m = -50; m < 0; m += 5) {
            let color = m < -30 ? '#f00' : (m < -15 ? '#fa0' : '#ddd');
            drawTick(m, color, m % 10 === 0);
        }
        for (let m = -50; m < 0; m += 5) {
            let color = m < -30 ? '#f00' : (m < -15 ? '#fa0' : '#ddd');
            drawTickRight(m, color, m % 10 === 0);
        }

        ctx.restore();
    }


    // maps a value from [istart, istop] into [ostart, ostop]
    map(value, istart, istop, ostart, ostop) {
        return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
    }

    // passage echelle linéaire -> echelle logarithmique
    mapLinearToLog(x, istart, istop, ostart, ostop) {
        var value = x;
        var minp = istart;
        var maxp = istop;
        var minv = Math.log(ostart);
        var maxv = Math.log(ostop);
        var scale = (maxv - minv) / (maxp - minp);
        value = Math.exp(minv + scale * (value - minp));
        return value;
    }

    inittrait(ctx, A) {
        ctx.save();
        ctx.translate(this.wA / 2, this.hA - 10);
        ctx.rotate(A);

        // Needle Glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#f00";

        ctx.fillStyle = "#f33";
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(4, 0);
        ctx.lineTo(1.5, -78);
        ctx.lineTo(-1.5, -78);
        ctx.closePath();
        ctx.fill();

        // Pivot
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#000";
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#444";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#777";
        ctx.stroke();

        ctx.restore();
    }

    drawLED(ctx, x, y, radius, color, glow) {
        ctx.beginPath();
        let grad = ctx.createRadialGradient(x - radius / 3, y - radius / 3, radius / 10, x, y, radius);
        if (glow) {
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.2, color);
            grad.addColorStop(1, '#222');
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
        } else {
            grad.addColorStop(0, '#666');
            grad.addColorStop(0.5, '#222');
            grad.addColorStop(1, '#111');
            ctx.shadowBlur = 0;
        }
        ctx.fillStyle = grad;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
    }

    initdiiode(ctx) {
        ctx.clearRect(0, 0, 170, 20);
        this.drawLED(ctx, 25, 10, 6, '#f00', false);
        this.drawLED(ctx, 85, 10, 6, '#0f0', false);
        this.drawLED(ctx, 145, 10, 6, '#f00', false);
    }

    angle_frequence(f) { // variation de l'angle en fonction de la fréquence émise
        var note = this.noteFromPitch(f);
        var cents = this.centsOffFromPitch(f, note);
        var ref_freq = this.frequencyFromNoteNumber(note);
        var cnorm;
        if (f < ref_freq) {
            cnorm = this.map(cents, -50, 0, 1, 0.1);
            cnorm = this.mapLinearToLog(cnorm, 0.1, 1, 0.1, 1);
            this.Angle = this.map(cnorm, 1, 0.1, -Math.PI / 2 + 0.2, 0); //angle
            return this.Angle;
        } else {
            cnorm = this.map(cents, 0, 50, 0.1, 1);
            cnorm = this.mapLinearToLog(cnorm, 0.1, 1, 0.1, 1);
            this.Angle = this.map(cnorm, 0.1, 1, 0, Math.PI / 2 - 0.2); //angle
            return this.Angle;
        }
    }

    Modifdio(ctx, ecart, side) {
        ctx.save();
        ctx.clearRect(0, 0, 170, 20);

        let leftGlow = false;
        let leftColor = '#f00';
        let rightGlow = false;
        let rightColor = '#f00';
        let centerGlow = false;

        if (side == "flat" && ecart <= -5) {
            leftGlow = true;
            if (ecart >= -15) leftColor = "#0f0";
            else if (ecart >= -35) leftColor = "#fa0";
            else leftColor = "#f00";
        }

        if (side == "sharp" && ecart >= 5) {
            rightGlow = true;
            if (ecart <= 15) rightColor = "#0f0";
            else if (ecart <= 35) rightColor = "#fa0";
            else rightColor = "#f00";
        }

        if (ecart <= 5 && ecart >= -5) {
            centerGlow = true;
        }

        this.drawLED(ctx, 25, 10, 6, leftColor, leftGlow);
        this.drawLED(ctx, 85, 10, 6, '#0f0', centerGlow);
        this.drawLED(ctx, 145, 10, 6, rightColor, rightGlow);

        ctx.restore();
    }



    /*autoCorrelate(buf, sampleRate) {
         var MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
         var GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be
         var SIZE = buf.length;
         var MAX_SAMPLES = Math.floor(SIZE / 2);
         var best_offset = -1;
         var best_correlation = 0;
         var rms = 0;
         var foundGoodCorrelation = false;
         var correlations = new Array(MAX_SAMPLES);
 
         for (var i = 0; i < SIZE; i++) {
             var val = buf[i];
             rms += val * val;
         }
         rms = Math.sqrt(rms / SIZE);
         if (rms < 0.01) // not enough signal
             return -1;
 
         var lastCorrelation = 1;
         for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
             var correlation = 0;
 
             for (var i = 0; i < MAX_SAMPLES; i++) {
                 correlation += Math.abs((buf[i]) - (buf[i + offset]));
             }
             correlation = 1 - (correlation / MAX_SAMPLES);
             correlations[offset] = correlation; // store it, for the tweaking we need to do below.
             if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
                 foundGoodCorrelation = true;
                 if (correlation > best_correlation) {
                     best_correlation = correlation;
                     best_offset = offset;
                 }
             } else if (foundGoodCorrelation) {
                 // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
                 // Now we need to tweak the offset - by interpolating between the values to the left and right of the
                 // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
                 // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
                 // (anti-aliased) offset.
 
                 // we know best_offset >=1, 
                 // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and 
                 // we can't drop into this clause until the following pass (else if).
                 var shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
                 return sampleRate / (best_offset + (8 * shift));
             }
             lastCorrelation = correlation;
         }
         if (best_correlation > 0.01) {
             // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
             return sampleRate / best_offset;
         }
         return -1;
         //	var best_frequency = sampleRate/best_offset;
     }*/

    /*
     * Autocorrelation purposed by dalatant, at this link: 
     * https://github.com/cwilso/PitchDetect/pull/23/commits/b0d5d28d2803d852dd85d2a1e53c22bcedba4cbf
     */
    autoCorrelate(buf, sampleRate) {
        // Implements the ACF2+ algorithm
        var SIZE = buf.length;
        var rms = 0;
        for (var i = 0; i < SIZE; i++) {
            var val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) // not enough signal
            return -1;
        var r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (var i = 0; i < SIZE / 2; i++)
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (var i = 1; i < SIZE / 2; i++)
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        buf = buf.slice(r1, r2);
        SIZE = buf.length;
        var c = new Array(SIZE).fill(0);
        for (var i = 0; i < SIZE; i++)
            for (var j = 0; j < SIZE - i; j++)
                c[i] = c[i] + buf[j] * buf[j + i];
        var d = 0; while (d < SIZE - 1 && c[d] > c[d + 1]) d++;

        // Find global max to establish a threshold
        var globalMax = -1;
        for (var i = d; i < SIZE; i++) {
            if (c[i] > globalMax) {
                globalMax = c[i];
            }
        }

        var maxval = -1, maxpos = -1;
        var threshold = globalMax * 0.9;

        // Find the FIRST local peak that exceeds the threshold
        for (var i = d; i < SIZE - 1; i++) {
            if (c[i] >= threshold && c[i] > c[i + 1] && (i === 0 || c[i] > c[i - 1])) {
                maxval = c[i];
                maxpos = i;
                break;
            }
        }

        if (maxpos === -1) {
            maxpos = d;
        }
        var T0 = maxpos;
        var x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        var a = (x1 + x3 - 2 * x2) / 2;
        var b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);
        return sampleRate / T0;
    }

    /* increaseSemiTone() {
         if (this.toneLevel < 2) {
             this.toneLevel++;
             this.indicateTone(this.toneLevel);
         }
         console.log("increase semitone level : toneLevel =" + this.toneLevel)
     }
 
     decreaseSemiTone() {
         if (this.toneLevel > -2) {
             this.toneLevel--;
             this.indicateTone(this.toneLevel);
         }
         console.log("decrease semitone level : toneLevel =" + this.toneLevel);
     }
 
     //Function about indicating the correct note depending of tuning mode
     indicateTone(toneLevel) {
         let freq = this.autoCorrelate(this.buf, this.context.sampleRate);
         toneLevel = this.toneLevel;
         let freqTest = Math.round(freq);
         let intMin = 0;
         let intMax = 0;
         let freqMin = freqTest;
         let freqMax = freqTest;
         var detuneLessMode = this.shadowRoot.getElementById("lessArrow");
         var detuneMoreMode = this.shadowRoot.getElementById("moreArrow");
 
 
         switch (toneLevel) {
             //Chord Mode, 0 is the standard tuning
             case -2:
                 this.frequencyString = [73, 98, 131, 175, 220, 294];
                 break;
             case -1:
                 this.frequencyString = [78, 104, 139, 185, 233, 311];
                 break;
             case 0:
                 this.frequencyString = [82, 110, 147, 196, 247, 330];
                 break;
             case 1:
                 this.frequencyString = [87, 117, 156, 208, 262, 349];
                 break;
             case 2:
                 this.frequencyString = [92, 123, 165, 220, 277, 370];
                 break;
         }
 
         /*
          *  The goal here is while the frequency isn't close to one of frequency
          *  present in the table, we must to catch on which interval the frequency is present
          *  and after to indicate if the user must to tune more or less depending of the position
          *  in the interval
          *
 
         //If the frequency catched not corresponding to a frequency in the table and the value between the frequency of the first string and last string
         if (this.frequencyString.indexOf(freqMin) == -1 && freqTest > this.frequencyString[0] && freqTest < this.frequencyString[5]) {
             while (this.frequencyString.indexOf(freqMin) == -1 && freqMin > 0) {
 
                 //We decrease freqMin to find the first value of the interval
                 freqMin--;
                 //Until we find the first value of the interval
                 if (this.frequencyString.indexOf(freqMin) != -1) {
                     intMin = this.frequencyString[this.frequencyString.indexOf(freqMin)];
                 }
 
             }
             //Same test but to find the second value for the interval
             while (this.frequencyString.indexOf(freqMax) == -1) {
                 freqMax++;
                 if (this.frequencyString.indexOf(freqMax) != -1) {
                     intMax = this.frequencyString[this.frequencyString.indexOf(freqMax)];
                 }
             }
 
             //If the frequency catched is not closed of the exact frequency
             if (freqTest > intMin + 2 || freqTest < intMax - 2) {
                 let middle = (intMin + intMax) / 2;
                 //if the frequency catched is above of the middle of the interval or under the frequency of the first string
                 if (freqTest > middle || freqTest < this.frequencyString[0]) {
                     //If it's closed to the max interval
                     if (freqTest > intMax - 2 && freqTest < intMax + 2) {
                         detuneLessMode.innerHTML = "";
                         detuneMoreMode.innerHTML = "";
                     } else {
                         //Otherwise We told to increase the tuning
                         detuneLessMode.innerHTML = "↑";
                         detuneMoreMode.innerHTML = "";
                     }
                 }
                 else if (freqTest < middle || freqTest > this.frequencyString[5]) {
                     //Inversing test
                     if (freqTest > intMin - 2 && freqTest < intMin + 2) {
                         detuneLessMode.innerHTML = "";
                         detuneMoreMode.innerHTML = "";
                     } else {
                         detuneMoreMode.innerHTML = "";
                         detuneLessMode.innerHTML = "↓";
                     }
                 }
             }
         } else {
             if (freqTest < this.frequencyString[0] - 2 && freqTest > 0) {
                 detuneLessMode.innerHTML = "↑";
                 detuneMoreMode.innerHTML = "";
             }
             else if (freqTest > this.frequencyString[5] + 2) {
                 detuneMoreMode.innerHTML = "";
                 detuneLessMode.innerHTML = "↓";
             }
             else {
                 detuneMoreMode.innerHTML = "";
                 detuneLessMode.innerHTML = "";
             }
         }
         this.valueSaved = freqTest;
     }
     */
}

if (!customElements.get(TunerHTMLElement.is())) {
    customElements.define(TunerHTMLElement.is(), TunerHTMLElement);
}
