var ModMatrix = function (svg,root,paramHandler)
{
  var xlabelz = -1;
  var xlabels = [];
  var params = [];
  var toggles = [];
  var self = this;

  var src = ["lfo1","lfo2","pressure","velocity","keyboard","filter env","mod wheel"];
  var dst = ["freq A","freq B","freq C","freq D","mix A-C","mix B-D",
             "filter","amp","pan","chr rate","chr amnt",
             "lfo1 rate","lfo1 amnt","lfo2 rate","lfo2 amnt"];
  var mod = [
    "ooooooo o    oo",
    "ooooooo o  oo  ",
    "ooooooooooooooo",
    "    ooooo      ",
    "    ooo o      ",
    "oooo    o      ",
    "          o o o"
  ];
  /*"ooooooo--oo o--", 75
    "ooooooooo---o  ", 90
    "ooooooooooooooo", 105
    "----ooo----oo  ", 120
    "----ooo    -o  ", 135
    "oooo--------o  ", 150
    "--------o o---o"}*/
  var xmodMap = [0,1,2,3,5,6,4, 11,12,13,14,7,8,9,10];
  var idMap = [
    [75,76,77,78, 80,81,79,0,84, 0,0, 0,0,82,83],
    [85,86,87,88, 90,91,89,0,94, 0,0, 92,93,0,0],
    [95,96,97,98, 100,101,99,106,107, 108,109, 102,103,104,105],
    [0,0,0,0, 111,112,110,113,114, 0,0, 0,0,0,0],
    [0,0,0,0, 116,117,115,0,118,   0,0, 0,0,0,0],
    [119,120,121,122, 0,0,0,0,123, 0,0, 0,0,0,0],
    [0,0,0,0, 0,0,0,0,0, 0,126, 0,124,0,125]
  ];

  var gdst = root.querySelector("#gdst");
  var grid = root.querySelector("#grid");

  function onmatrix (e) {
    var c = e.target;
    c.classList.toggle("selected");
    let value = c.classList.contains("selected") ? 1 : 0;
    // let id = idMap[c.row][c.index];
    let id = c.toggleIndex - 75;
    // if (id == 82) id = 83;
    // toggles[id].setValue(value, self);
    // c.paramIndex = 75;
    xparams[c.paramIndex].setValue(value, self);
    // console.log(id,c.toggleIndex);
    // console.dir(toggles[c.toggleIndex])
  }

  svg.onmousemove = function (e) {
    var x = e.clientX - 8 - 10;
    var y = e.clientY;
    if (x < 0 || x > 245 || y < 56 || y > 156) {
      if (xlabelz >= 0) {
        xlabels[xlabelz].classList.remove("hilited");
        xlabelz = -1;
      }
    }
    else {
      if (x < 240)
        x += 16.75 / 2;
      var col = (x / 16.75) | 0;
      if (col != xlabelz && col < xlabels.length) {
        if (xlabelz >= 0)
          xlabels[xlabelz].classList.remove("hilited");
        xlabelz = col;
        xlabels[col].classList.add("hilited");
      }
    }
  }
  svg.onmouseleave = function () {
    if (xlabelz >= 0) {
      xlabels[xlabelz].classList.remove("hilited");
      xlabelz = -1;
    }
  }

  // -- xlabels
  var tx = 0, ty = 40;
  for (var i=0; i<dst.length; i++) {
    var s = dst[i];
    var t = text(tx,ty, s);
    xlabels.push(t);
    gdst.appendChild(t);
    tx += 12; ty += 12;
  }

  // -- lines
  for (var i = 0; i < src.length; i++) {
    var y = 5 + i * 15;
    grid.appendChild( line(5,y,240,y) );
  }
  for (var i = 0; i < dst.length; i++) {
    var x = 5 + i * 16.75;
    grid.appendChild( line(x,5,x,96) );
  }

  // -- circles
  var t = 75;
  for (var row = 0; row < src.length; row++) {
    var y = 5 + row * 15;
    var z = 0;
    for (var col = 0; col < dst.length; col++) {
      var x = 5 + col * 16.75;
      if (mod[row][col] == 'o') {
        var c = circle(x,y);
        c.row = row; c.col = col;
        c.index = z;
        c.paramIndex  = idMap[row][col];
        c.toggleIndex = 75 + row * 15 + xmodMap[col % 15];
        c.onclick = onmatrix;
        grid.appendChild(c);
        z++;
      }
    }
    t += z;
  }

  this.setToggles = function (params,n) {
    let circles = Array.from(grid.querySelectorAll("circle"));
    for (var i=n; i<180; i++) {
      let toggle = circles.find((c) => { return c.toggleIndex == params[i].id });
      if (toggle) {
        let v = params[i].scaledValue;
        if (v)  toggle.classList.add("selected");
        else    toggle.classList.remove("selected");
      }
    }
/*    function findToggle (id) { // ow,col) {
      for (let i=0; i<circles.length; i++)
        if (circles[i].toggleIndex == id)
//        if (circles[i].row == row && circles[i].col == col)
          return circles[i];
      return null;
    }
    let circles = grid.querySelectorAll("circle");

    for (let y=0; y<7; y++) {
      for (let x=0; x<15; x++) {
        let v = params[n++].scaledValue;
        let z = xmodMap[x];
        // if (mod[y][x] == 'o') {
          let c = findToggle(params[n-1].id); // y,z);
          if (c) {
            if (v)  c.classList.add("selected");
            else    c.classList.remove("selected");
            if (v) console.log(params[n-1].id,y,x,z);
          }
        // }
      }
    } */
  }

  this.restoreToggles = function (params) {
    let circles = Array.from(grid.querySelectorAll("circle"));
    for (var i=75; i<180; i++) {
      let toggle = circles.find((c) => { return c.toggleIndex == params[i].id });
      if (toggle) {
        let v = params[i].scaledValue;
        if (v)  toggle.classList.add("selected");
        else    toggle.classList.remove("selected");
        params[toggle.paramIndex].setValue(v);
      }
    }

    /* function findToggle (id) {
      for (let i=0; i<circles.length; i++)
        if (params[circles[i].toggleIndex].id == id)
        // if (circles[i].row == row && circles[i].col == col)
          return circles[i];
      return null;
    }
    let circles = grid.querySelectorAll("circle"); */

    /* for (let i=0; i<toggles.length; i++) {
      let t = toggles[i];
      console.log(t.id)
    }
    return; */

    /* for (let y=0; y<7; y++) {
      for (let x=0; x<15; x++) {
        let z = xmodMap[x];
        let p = params[n++];
        if (p.scaledValue) console.log(y,x,z);
        if (mod[y][x] == 'o') {
          let v = p.scaledValue;
          let c = findToggle(p.id);
          if (c) {
            if (v)  c.classList.add("selected");
            else    c.classList.remove("selected");
          }
        }
      }
    } */
  }

  Object.defineProperties(this, {
    param: { set: (v) => {
      params = [];
      for (let i=0; i<7; i++) {
        let id = 56 + i;
        params.push( v[id] );
        //v[id].observe(paramHandler);
      }
      toggles = [];
      for (let i=75; i<180; i++) {
        toggles.push( v[i] );
        //v[i].observe(paramHandler);
      }
      xparams = v;
    }}
  });

}
