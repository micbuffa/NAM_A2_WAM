var Knob = function (id, elem, root)
{
  var bipolar = elem.classList.contains("bipolar");
  var hasdot = true;
  var param;

  function onmouse (e) {
    if (e.type == "mousedown") {
      prev = e.clientY;
      if (hasdot) dot.style.fill = "steelblue";
      val.style.fill = "#ccc";
      window.addEventListener("mousemove", onmouse, false);
      window.addEventListener("mouseup",   onmouse, false);
    }
    else if (e.type == "mousemove") {
      var delta = prev - e.clientY;
      if (delta == 0) return;
      var v = value + delta/120;
      if (v > 1) v = 1;
      if (!bipolar && v < 0) v = 0;
      else if (v < -1) v = -1;
      if (v != value) {
        self.setValue(v,true);
        if (self.oninput) self.oninput(id, value);

      }
      prev = e.clientY;
    }
    else {
      if (hasdot) dot.style.fill = "#888";
      val.style.fill = "#aaa";
      window.removeEventListener("mousemove", onmouse, false);
      window.removeEventListener("mouseup",   onmouse, false);
    }
    e.stopPropagation();
  }

  var tmp = root.querySelector("#knob");
  elem.appendChild(document.importNode(tmp.content, true));

  var cx = elem.querySelector("#back1").getAttribute("cx")|0;
  var cy = elem.querySelector("#back1").getAttribute("cy")|0;
  var r1 = cx - 2;
  var a1 = bipolar ? 0 : -160;
  var a2 = bipolar ? 160 : 320;
  var value = 0;
  var self = this;

  var knob = elem.querySelector("#gknob");
  var dot = elem.querySelector("#dot");
  var arc = elem.querySelector("#arc");
  var val = elem.querySelector("#val");
  knob.onmousedown = onmouse;

  this.setValue = function (v,notify) {
    value = v;
    var rot;
    var angle1 = a1;
    var angle2 = 320 * v;
    if (bipolar) {
      angle2 /= 2;
      rot = angle2;
      if (value < 0) {
        angle1 = angle2; angle2 = 0;
      }
    }
    else {
      angle2 -= 160;
      rot = angle2;
    }
    arc.setAttribute("d", arcpath(cx,cy,r1,angle1,angle2,0));
    knob.style.transform = "rotate(" +  rot + "deg)";
    var t;
    if (bipolar)
      t = (value * 63)|0;
    else {
      t = (value * 100)|0;
      if (t > 99) t = 99;
    }
    val.textContent = t;

    if (notify && param)
      param.setValue(t, this);
  }
  self.setValue(0, false);

  this.valueChanged = (p) => { this.value = p.value; }

  Object.defineProperties(this, {
    value: { set: (v) => { this.setValue(v,false); }},
    param: { set: (v) => { param = v; param.observe(this); }}
  })
}
