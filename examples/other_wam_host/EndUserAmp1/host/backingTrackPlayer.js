
export default class BackingTrackPlayer {
    constructor(audioContext, destNode) {
        this.ctx = audioContext;
        this.dest = destNode;
        this.pluginGainNode = window.outputGainNode;
        
        this.playlist = [];

        this.loadPlaylist();

        this.currentBuffer = null;
        this.originalBuffer = null; // Keep original for re-stretching
        this.source = null;
        
        // Backing track path
        this.btGainNode = this.ctx.createGain();
        this.btGainNode.gain.value = 0.8;
        this.btGainNode.connect(this.dest);

        // Mix logic: 0 = 100% Plugins, 1 = 100% Backing Track
        this.mixValue = 0.5; 

        this.playbackRate = 1.0;
        this.loopStart = 0;
        this.loopEnd = 1.0;
        this.isLooping = true;
        this.isPlaying = false;

        // Phase Vocoder AudioWorklet for real-time time stretching
        this.phazeNode = null;
        this.workletReady = false;
        this.timeStretchEnabled = false;
        if (this.ctx.audioWorklet) {
            this.ctx.audioWorklet.addModule('./phaze-processor.js')
                .then(() => {
                    this.phazeNode = new AudioWorkletNode(this.ctx, 'phase-vocoder-processor', {
                        numberOfInputs: 1,
                        numberOfOutputs: 1,
                        outputChannelCount: [2]
                    });
                    this.workletReady = true;
                    console.log('[BackingTrack] Phase Vocoder worklet ready');
                    // Enable slider once worklet is ready
                    if (this.dom && this.dom.speed) {
                        this.dom.speed.disabled = false;
                        this.dom.speed.closest('.bt-param').classList.remove('disabled');
                        this.dom.speed.closest('.bt-param').title = '';
                    }
                })
                .catch(e => console.error('[BackingTrack] Worklet error', e));
        }

        this.initUI();
    }

    initUI() {
        const container = document.createElement('div');
        container.id = 'backing-track-player';
        container.innerHTML = `
            <style>
                #backing-track-player {
                    background: #111;
                    border-top: 2px solid #333;
                    padding: 1rem;
                    display: flex;
                    gap: 15px;
                    color: #eee;
                    height: 240px;
                    box-sizing: border-box;
                    font-family: 'Inter', sans-serif;
                }
                .playlist-box {
                    flex: 0 0 280px;
                    background: #0a0a0a;
                    border: 1px solid #222;
                    border-radius: 6px;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .playlist-header {
                    padding: 8px 12px;
                    background: #1a1a1a;
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: #888;
                    border-bottom: 1px solid #222;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .btn-bt-upload {
                    background: none;
                    border: 1px solid #444;
                    color: #aaa;
                    font-size: 1rem;
                    cursor: pointer;
                    width: 24px; height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: all 0.2s;
                    padding: 0;
                }
                .btn-bt-upload:hover { border-color: #38bdf8; color: #38bdf8; background: rgba(56, 189, 248, 0.1); }

                .bt-list {
                    overflow-y: auto;
                    flex: 1;
                    background: #0a0a0a;
                }
                .bt-item {
                    padding: 8px 12px;
                    font-size: 0.75rem;
                    cursor: pointer;
                    border-bottom: 1px solid #111;
                    transition: all 0.2s;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    color: #aaa;
                }
                .bt-item:hover { background: #1a1a1a; color: #fff; }
                .bt-item.active { 
                    background: #222; 
                    border-left: 3px solid #38bdf8;
                    color: #38bdf8;
                    font-weight: bold;
                }

                .bt-main-controls {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    min-width: 0; /* Prevent flex overflow */
                }
                .bt-viz {
                    height: 120px; /* Slightly taller for better visualization */
                    background: #050505;
                    border: 1px solid #222;
                    border-radius: 6px;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .bt-viz.drag-over {
                    border-color: #38bdf8;
                    background: rgba(56, 189, 248, 0.1);
                    box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.3);
                }
                canvas#bt-waveform { width: 100%; height: 100%; display: block; }
                
                .bt-loop-mask {
                    position: absolute;
                    top: 0; height: 100%;
                    background: rgba(251, 191, 36, 0.25); /* Amber color for better visibility */
                    border-left: 2px solid #fbbf24;
                    border-right: 2px solid #fbbf24;
                    pointer-events: none;
                    z-index: 5;
                }

                .bt-playhead {
                    position: absolute;
                    top: 0; width: 2px; height: 100%;
                    background: #ff4444;
                    box-shadow: 0 0 5px rgba(255, 68, 68, 0.8);
                    pointer-events: none;
                    z-index: 10;
                    display: none;
                }
                
                .bt-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    background: #1a1a1a;
                    padding: 8px 15px;
                    border-radius: 6px;
                    border: 1px solid #333;
                    height: 70px;
                    box-sizing: border-box;
                }
                .btn-bt-play {
                    width: 50px; height: 50px;
                    border-radius: 50%;
                    border: none;
                    background: #38bdf8;
                    color: #000;
                    font-weight: 900;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
                }
                .btn-bt-play.playing { background: #f87171; box-shadow: 0 0 15px rgba(248, 113, 113, 0.3); }

                .bt-param {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 140px;
                }
                .bt-param.disabled { opacity: 0.3; pointer-events: none; }
                .bt-param label { font-size: 0.65rem; color: #666; text-transform: uppercase; font-weight: 800; }
                .bt-param-val { color: #38bdf8; font-weight: bold; margin-left: auto; font-family: monospace; }
                .bt-row { display: flex; align-items: center; width: 100%; }
                
                input[type=range] {
                    -webkit-appearance: none;
                    background: #333;
                    height: 4px;
                    border-radius: 2px;
                }
                input[type=range]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 12px; height: 12px;
                    background: #eee;
                    border-radius: 50%;
                    cursor: pointer;
                }
                .bt-time-display {
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    font-size: 0.7rem;
                    font-family: monospace;
                    background: rgba(0,0,0,0.7);
                    padding: 2px 8px;
                    border-radius: 4px;
                    color: #aaa;
                    pointer-events: none;
                    z-index: 15;
                    border: 1px solid #333;
                }
            </style>

            <div class="playlist-box">
                <div class="playlist-header">
                    <span>BACKING TRACKS</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn-bt-upload" id="bt-upload-btn" title="Load local file">⏏</button>
                        <span id="bt-count">0</span>
                    </div>
                </div>
                <div class="bt-list" id="bt-list" style="overflow-y: auto;"></div>
            </div>

            <div class="bt-main-controls">
                <div class="bt-viz" id="bt-viz">
                    <canvas id="bt-waveform"></canvas>
                    <div id="bt-loop-region" class="bt-loop-mask"></div>
                    <div id="bt-playhead" class="bt-playhead"></div>
                    <div id="bt-time" class="bt-time-display">00:00 / 00:00</div>
                </div>

                <div class="bt-toolbar">
                    <button class="btn-bt-play" id="bt-play-btn">▶</button>

                    <div class="bt-param disabled" title="Loading worklet...">
                        <div class="bt-row">
                            <label>TIME STRETCH</label>
                            <span class="bt-param-val" id="bt-speed-txt">100%</span>
                        </div>
                        <input type="range" id="bt-speed-slider" min="0.5" max="1.5" step="0.01" value="1.0" disabled>
                    </div>

                    <div class="bt-param" style="min-width: 120px;">
                        <div class="bt-row">
                            <label>GUITAR PAN</label>
                            <span class="bt-param-val" id="bt-pan-txt">C</span>
                        </div>
                        <input type="range" id="bt-pan-slider" min="-1" max="1" step="0.01" value="0">
                    </div>

                    <div class="bt-param" style="min-width: 180px;">
                        <div class="bt-row">
                            <label>MIX (GUITAR ↔ BACKING)</label>
                            <span class="bt-param-val" id="bt-mix-txt">50/50</span>
                        </div>
                        <input type="range" id="bt-mix-slider" min="0" max="1" step="0.01" value="0.5">
                    </div>

                    <div style="font-size: 0.7rem; color: #666; display: flex; align-items: center; gap: 6px;">
                        <input type="checkbox" id="bt-loop-check" checked> LOOP
                    </div>
                </div>
            </div>
            <input type="file" id="bt-file-input" style="display: none;" accept="audio/*">
        `;

        document.getElementById('main-area').appendChild(container);

        this.dom = {
            list: container.querySelector('#bt-list'),
            play: container.querySelector('#bt-play-btn'),
            speed: container.querySelector('#bt-speed-slider'),
            speedTxt: container.querySelector('#bt-speed-txt'),
            pan: container.querySelector('#bt-pan-slider'),
            panTxt: container.querySelector('#bt-pan-txt'),
            mix: container.querySelector('#bt-mix-slider'),
            mixTxt: container.querySelector('#bt-mix-txt'),
            loop: container.querySelector('#bt-loop-check'),
            waveform: container.querySelector('#bt-waveform'),
            loopRegion: container.querySelector('#bt-loop-region'),
            playhead: container.querySelector('#bt-playhead'),
            viz: container.querySelector('#bt-viz'),
            upload: container.querySelector('#bt-upload-btn'),
            fileInput: container.querySelector('#bt-file-input'),
            time: container.querySelector('#bt-time')
        };

        this.populateList();
        this.setupEvents();
        this.setupDragAndDrop();
        
        // Initial Mix
        this.updateMix(0.5);

        // State for playhead tracking
        this.playbackStartTime = 0;
        this.playbackOffset = 0;
        this.animFrame = null;
    }

    async loadPlaylist() {
        try {
            // First try to load from tracks.json (more robust for production)
            const response = await fetch('./backingTracks/tracks.json');
            if (response.ok) {
                const fileList = await response.json();
                this.playlist = fileList.map(filename => ({
                    name: filename
                        .replace(/\.(mp3|wav|ogg)$/i, '')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/_/g, ' ')
                        .trim(),
                    url: `./backingTracks/${filename}`
                }));
            } else {
                // Fallback: Fetching a directory URL usually returns an HTML index in dev servers
                const responseDir = await fetch('./backingTracks/');
                const html = await responseDir.text();
                
                // Create a temporary DOM to parse links
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = Array.from(doc.querySelectorAll('a'));
                
                const fileList = links
                    .map(link => link.getAttribute('href'))
                    .filter(href => href && href.match(/\.(mp3|wav|ogg)$/i))
                    .map(href => decodeURIComponent(href).split('/').pop());

                // Deduplicate (some servers list files twice or with paths)
                const uniqueFiles = [...new Set(fileList)];

                this.playlist = uniqueFiles.map(filename => ({
                    name: filename
                        .replace(/\.(mp3|wav|ogg)$/i, '')
                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
                        .replace(/_/g, ' ')
                        .trim(),
                    url: `./backingTracks/${filename}`
                }));
            }
            this.populateList();
        } catch (e) {
            console.error("Could not load backing tracks", e);
        }
    }

    populateList() {
        this.dom.list.innerHTML = '';
        this.playlist.forEach((track, i) => {
            const div = document.createElement('div');
            div.className = 'bt-item';
            div.textContent = track.name;
            div.onclick = () => this.load(i);
            this.dom.list.appendChild(div);
        });
        document.getElementById('bt-count').textContent = this.playlist.length;
    }

    setupEvents() {
        this.dom.play.onclick = () => this.toggle();

        // Time Stretch slider: changes playbackRate + phase vocoder pitch correction
        this.dom.speed.oninput = (e) => {
            this.playbackRate = parseFloat(e.target.value);
            this.dom.speedTxt.textContent = `${Math.round(this.playbackRate * 100)}%`;
            
            const needsStretching = Math.abs(this.playbackRate - 1.0) > 0.01;
            this.timeStretchEnabled = needsStretching;

            if (this.source) {
                this.source.playbackRate.value = this.playbackRate;
            }
            // Update phase vocoder pitch correction: compensate for speed change
            if (this.phazeNode && this.workletReady) {
                const pitchCorrection = needsStretching ? (1.0 / this.playbackRate) : 1.0;
                this.phazeNode.parameters.get('pitchFactor').setValueAtTime(pitchCorrection, this.ctx.currentTime);
            }

            // Reconnect audio graph if playing
            if (this.isPlaying) {
                this.play();
            }
        };

        // Guitar Pan slider: controls stereo panning of plugin chain
        this.dom.pan.oninput = (e) => {
            const panValue = parseFloat(e.target.value);
            if (window.pluginPannerNode) {
                window.pluginPannerNode.pan.setValueAtTime(panValue, this.ctx.currentTime);
            }
            // Display: L100...C...R100
            if (Math.abs(panValue) < 0.01) {
                this.dom.panTxt.textContent = 'C';
            } else if (panValue < 0) {
                this.dom.panTxt.textContent = `L${Math.round(Math.abs(panValue) * 100)}`;
            } else {
                this.dom.panTxt.textContent = `R${Math.round(panValue * 100)}`;
            }
        };

        this.dom.mix.oninput = (e) => {
            this.updateMix(parseFloat(e.target.value));
        };
        this.dom.loop.onchange = (e) => {
            this.isLooping = e.target.checked;
            if (this.source) this.source.loop = this.isLooping;
        };

        let isDragging = false;
        this.dom.viz.onmousedown = (e) => {
            isDragging = true;
            const r = this.dom.viz.getBoundingClientRect();
            this.loopStart = (e.clientX - r.left) / r.width;
            this.updateLoop();
        };
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const r = this.dom.viz.getBoundingClientRect();
            let x = (e.clientX - r.left) / r.width;
            this.loopEnd = Math.max(0, Math.min(1, x));
            this.updateLoop();
        });
        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            if (this.loopStart > this.loopEnd) [this.loopStart, this.loopEnd] = [this.loopEnd, this.loopStart];
            if (this.isPlaying) this.play();
        });

        window.addEventListener('resize', () => this.draw());

        // File upload button
        this.dom.upload.onclick = () => this.dom.fileInput.click();
        this.dom.fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) this.handleFile(file);
        };
    }

    setupDragAndDrop() {
        const dropZone = this.dom.viz;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.add('drag-over'), false);
        });

        ['dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, () => dropZone.classList.remove('drag-over'), false);
        });

        dropZone.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (file) this.handleFile(file);
        }, false);
    }

    async handleFile(file) {
        if (!file.type.match('audio.*')) {
            alert("Please drop an audio file.");
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                this.currentBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                
                // Add to playlist (temporary)
                const newTrack = {
                    name: "[LOCAL] " + file.name.replace(/\.[^/.]+$/, ""),
                    url: "#local",
                    buffer: this.currentBuffer
                };
                this.playlist.unshift(newTrack);
                this.populateList();
                this.load(0); // Load the first one (the one we just added)
            };
            reader.readAsArrayBuffer(file);
        } catch (e) {
            console.error("Error loading local file", e);
        }
    }

    updateMix(val) {
        this.mixValue = val;
        this.dom.mixTxt.textContent = `${Math.round((1-val)*100)}/${Math.round(val*100)}`;
        
        // Volume of backing track
        this.btGainNode.gain.setTargetAtTime(val * 1.5, this.ctx.currentTime, 0.05);

        // Volume of plugins (we need to find the node in index.js)
        if (window.outputGainNode) {
            window.outputGainNode.gain.setTargetAtTime((1 - val) * 1.5, this.ctx.currentTime, 0.05);
        }
    }

    updateLoop() {
        const s = Math.min(this.loopStart, this.loopEnd);
        const e = Math.max(this.loopStart, this.loopEnd);
        this.dom.loopRegion.style.left = `${s * 100}%`;
        this.dom.loopRegion.style.width = `${(e - s) * 100}%`;
    }

    async load(i) {
        const items = this.dom.list.querySelectorAll('.bt-item');
        items.forEach((it, idx) => it.classList.toggle('active', idx === i));

        const track = this.playlist[i];
        
        // If it's a local file with already decoded buffer
        if (track.buffer) {
            this.currentBuffer = track.buffer;
            this.loopStart = 0;
            this.loopEnd = 1.0;
            this.updateLoop();
            this.draw();
            if (this.isPlaying) this.play();
            return;
        }

        try {
            const res = await fetch(track.url);
            const ab = await res.arrayBuffer();
            this.currentBuffer = await this.ctx.decodeAudioData(ab);
            this.loopStart = 0;
            this.loopEnd = 1.0;
            this.updateLoop();
            this.draw();
            if (this.isPlaying) this.play();
        } catch (e) { console.error("Load error", e); }
    }

    draw() {
        if (!this.currentBuffer) return;
        
        // Update time display with duration even if not playing
        this.dom.time.textContent = `00:00 / ${this.formatTime(this.currentBuffer.duration)}`;

        const c = this.dom.waveform;
        const r = this.dom.viz.getBoundingClientRect();
        
        // Ensure high-DPI support or at least correct canvas sizing
        c.width = this.dom.viz.clientWidth;
        c.height = this.dom.viz.clientHeight;
        
        const ctx = c.getContext('2d');
        const d = this.currentBuffer.getChannelData(0);
        const step = Math.ceil(d.length / c.width);
        const amp = c.height / 2;

        ctx.clearRect(0, 0, c.width, c.height);
        
        // Draw center line
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.moveTo(0, amp);
        ctx.lineTo(c.width, amp);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < c.width; i++) {
            let min = 1, max = -1;
            for (let j = 0; j < step; j++) {
                const v = d[(i * step) + j];
                if (v < min) min = v; if (v > max) max = v;
            }
            // Draw a symmetric bar around the center
            const y = (1 + min) * amp;
            const h = Math.max(1, (max - min) * amp);
            ctx.fillRect(i, y, 1, h);
        }
    }

    toggle() {
        if (this.isPlaying) this.stop(); else this.play();
    }

    play() {
        if (!this.currentBuffer) return;
        this.stop();

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.currentBuffer;

        // Route through Phase Vocoder worklet if time stretching is active
        if (this.timeStretchEnabled && this.phazeNode && this.workletReady) {
            this.source.connect(this.phazeNode);
            this.phazeNode.connect(this.btGainNode);
        } else {
            this.source.connect(this.btGainNode);
        }
        
        this.isLooping = this.dom.loop.checked;
        this.source.loop = this.isLooping;
        
        const start = Math.min(this.loopStart, this.loopEnd) * this.currentBuffer.duration;
        const end = Math.max(this.loopStart, this.loopEnd) * this.currentBuffer.duration;
        
        this.source.loopStart = start;
        this.source.loopEnd = end;
        this.source.playbackRate.value = this.playbackRate;
        
        this.playbackStartTime = this.ctx.currentTime;
        this.playbackOffset = start;

        this.source.start(0, start);
        this.isPlaying = true;
        this.dom.play.textContent = '■';
        this.dom.play.classList.add('playing');
        this.dom.playhead.style.display = 'block';

        this.updatePlayhead();
    }

    stop() {
        if (this.source) { 
            try { 
                this.source.disconnect();
                this.source.stop(); 
            } catch(e){} 
            this.source = null; 
        }
        // Disconnect phazeNode output (will be reconnected on next play if needed)
        if (this.phazeNode) {
            try { this.phazeNode.disconnect(); } catch(e) {}
        }
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        
        this.isPlaying = false;
        this.dom.play.textContent = '▶';
        this.dom.play.classList.remove('playing');
        this.dom.playhead.style.display = 'none';
    }

    updatePlayhead() {
        if (!this.isPlaying || !this.currentBuffer) return;

        const duration = this.currentBuffer.duration;
        const elapsed = (this.ctx.currentTime - this.playbackStartTime) * this.playbackRate;
        let currentPos = this.playbackOffset + elapsed;

        const start = Math.min(this.loopStart, this.loopEnd) * duration;
        const end = Math.max(this.loopStart, this.loopEnd) * duration;

        if (this.isLooping && currentPos >= end) {
            // Handle loop wrap around for visualization
            const loopLen = end - start;
            currentPos = start + ((currentPos - start) % loopLen);
        }

        const percent = (currentPos / duration) * 100;
        this.dom.playhead.style.left = `${percent}%`;

        // Update time display
        this.dom.time.textContent = `${this.formatTime(currentPos)} / ${this.formatTime(duration)}`;

        this.animFrame = requestAnimationFrame(() => this.updatePlayhead());
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}
