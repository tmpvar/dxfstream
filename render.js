var boosh = require('boosh');
var dxfparser = require('./dxfstream');
var argv = require('optimist').argv;
var fs = require('fs');
var colors = require('colors');

var window = boosh.createWindow({
  width: 800,
  height: 600
});

window.addEventListener('keydown', function(ev) {
  if (ev.keyCode === 27) {
    window.close();
  }
})


var ctx = window.getContext('2d');

ctx.fillStyle = '#112';
ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
ctx.translate(window.innerWidth/2-200, window.innerHeight/2-200);

// ctx.scale(50, 50)
// ctx.scale(.5, .5)
// ctx.lineWidth = .025;
ctx.strokeStyle = "red";
ctx.fillStyle = "red";


var rads = function(degs) {
  var res = degs * (Math.PI/180);

  if (res > Math.PI) {
    console.log('here')
    res -= Math.PI*2
  }
  return res;
};

var min = Math.min;
var max = Math.max;

var renderers = {
  line : function(d) {
    ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      // ctx.lineWidth = .04;
      ctx.strokeStyle = d.layerName === 'VISIBLE' ? "green" : 'orange'
      ctx.stroke();
  },
  arc : function(d) {

    var a1 = rads(d.startAngle);
    var a2 = rads(d.endAngle);

    ctx.save();
      ctx.beginPath()
        ctx.translate(d.x, d.y);
        ctx.arc(0, 0, d.radius, a1, a2, false)

        ctx.strokeStyle = "yellow";
        ctx.stroke();
    ctx.restore();
  },
  circle : function(d) {

    ctx.save();
      ctx.beginPath()
        ctx.translate(d.x, d.y);
        ctx.arc(0, 0, d.radius, 0, Math.PI*2, false)

        ctx.strokeStyle = "yellow";
        ctx.stroke();
    ctx.restore();
  },
  spline : function(d) {

  },
  polyline: function(d) {
    console.log('polyline', d)
  },
  lwpolyline: function(d) {
    ctx.beginPath();
      var verts = d.vertices;
      var l = verts.length;

      ctx.moveTo(verts[0].x, verts[0].y)

      for (var i = 0; i<l; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }

      ctx.strokeStyle = "pink";
    ctx.closePath();
    ctx.stroke();
  }
}

fs.createReadStream(argv.file).pipe(dxfparser()).on('data', function(data) {
  if (data.type) {
    console.log(data.type);
    var type = data.type.toLowerCase();
    if (renderers[type]) {
      renderers[type](data);
    } else {
      console.error(('missing ' + type + ' renderer').red);
    }
  }
}).on('end', function() {
  window.requestAnimationFrame(function() {}) // render it.
})
