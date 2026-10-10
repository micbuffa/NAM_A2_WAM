var EGPoint = function (svg, eg, id, r, cls) {
  this.elem = null;
  this.id = id;
  var self = this;

  this.init = function (x,y,showLabel) {
    this.x = x;
    this.y = y;
    var g = svgGroup();
    var p = circle(0,0,r,cls);
    g.appendChild(p);
    if (showLabel) {
      var t = text(0,0, id+"", "eglabel");
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("alignment-baseline", "central");
      t.setAttribute("pointer-events", "none");
      g.appendChild(t);
    }
    p.onmousedown = onmouse;
    var xform = "translate(" + x + " " + y + ")";
    g.setAttribute("transform", xform);
    this.elem = g;
    return p;
  }

  this.setX = function (x) { this.setXY(x, this.y); }
  this.setY = function (y) { this.setXY(this.x, y); }

  this.setXY = function (x,y) {
    this.x = x;
    this.y = y;
    var xform = "translate(" + x + " " + y + ")";
    this.elem.setAttribute("transform", xform);
    updateLine();
  }

  function onmouse (e) {
    // var x = self.x;
    // var y = self.y;
    if (e.type == "mousedown") {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      eg.startDrag(self.id, pt);
      self.elem.setAttribute("stroke-width", 2);
      window.addEventListener("mousemove", onmouse, false);
      window.addEventListener("mouseup",   onmouse, false);
    }
    else if (e.type == "mousemove") {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      pt = eg.drag(self.id, pt);
      self.x = pt.x;
      self.y = pt.y;
      var xform = "translate(" + pt.x + " " + pt.y + ")";
      self.elem.setAttribute("transform", xform);
      updateLine();
    }
    else {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      eg.endDrag(self.id, pt);
      self.elem.setAttribute("stroke-width", 1);
      window.removeEventListener("mousemove", onmouse, false);
      window.removeEventListener("mouseup",   onmouse, false);
    }
    e.stopPropagation();
  }

  function updateLine () {
    if (self.L1) {
      self.L1.setAttribute("x2", self.x);
      self.L1.setAttribute("y2", self.y);
    }
    if (self.L2) {
      self.L2.setAttribute("x1", self.x);
      self.L2.setAttribute("y1", self.y);
    }
  }

  this.enable = (yesno) => {
    if (yesno) this.elem.children[0].classList.remove("disabled");
    else       this.elem.children[0].classList.add("disabled");
  }
}
