// TODO: turn this into a library

var argv = require('optimist').argv
var fs = require('fs');
var path = require('path');
var split = require('split');
var through = require('through');
var fsm = require('stream-fsm');
var file = argv.file;

var found = [];
var current = [];
var section = null;

var bool = function(val) {
  return !!parseInt(val);
};

var hex = function(val) {
  return parseInt(val, 16);
};

var processors = {};

var pairWise = true, collect = [], header = null, last = null;
var valueMap = {
  '1'  : ['text'],
  '2'  : ['name'],
  '3'  : ['value'], // Other text or name values
  '4'  : ['value'], // Other text or name values
  '5'  : ['entityHandle'],
  '6'  : ['lineType'],
  '7'  : ['textStyle'],
  '8'  : ['layerName'],
  '9'  : ['variable'],
  '10' : ['x', parseFloat],
  '20' : ['y', parseFloat],
  '30' : ['z', parseFloat],

  // Double-precision floating-point values
  // (text height, scale factors, and so on)
  '40' : ['value', parseFloat],
  '41' : ['value', parseFloat],
  '42' : ['value', parseFloat],
  '43' : ['value', parseFloat],
  '44' : ['value', parseFloat],
  '45' : ['value', parseFloat],
  '46' : ['value', parseFloat],
  '47' : ['value', parseFloat],

  // Angles (output in degrees to DXF files and
  //  radians through AutoLISP and ObjectARX applications)
  '50' : ['value', parseFloat],
  '51' : ['value', parseFloat],
  '52' : ['value', parseFloat],
  '53' : ['value', parseFloat],
  '54' : ['value', parseFloat],
  '55' : ['value', parseFloat],
  '56' : ['value', parseFloat],
  '57' : ['value', parseFloat],
  '58' : ['value', parseFloat],

  // Color number (fixed)
  '62' : ['colorNumber', parseInt],

  // Integer values (repeat counts, flag bits, or modes)
  '70' : ['value', parseInt],
  '71' : ['value', parseInt],
  '72' : ['value', parseInt],
  '73' : ['value', parseInt],
  '74' : ['value', parseInt],
  '75' : ['value', parseInt],
  '76' : ['value', parseInt],
  '77' : ['value', parseInt],
  '78' : ['value', parseInt],

  // Double-precision floating-point values (points, elevation, and DIMSTYLE settings, for example)
  '140' : ['value', parseFloat],
  '141' : ['value', parseFloat],
  '142' : ['value', parseFloat],
  '143' : ['value', parseFloat],
  '144' : ['value', parseFloat],
  '145' : ['value', parseFloat],
  '146' : ['value', parseFloat],
  '147' : ['value', parseFloat],
  '148' : ['value', parseFloat],
  '149' : ['value', parseFloat],

  // 16-bit integer values, such as flag bits representing DIMSTYLE settings
  '170' : ['value', parseInt],
  '171' : ['value', parseInt],
  '172' : ['value', parseInt],
  '173' : ['value', parseInt],
  '174' : ['value', parseInt],
  '175' : ['value', parseInt],
  '176' : ['value', parseInt],
  '177' : ['value', parseInt],
  '178' : ['value', parseInt],
  '179' : ['value', parseInt],

  // 16-bit integer value
  '270' : ['value', parseInt],
  '271' : ['value', parseInt],
  '272' : ['value', parseInt],
  '273' : ['value', parseInt],
  '274' : ['value', parseInt],
  '275' : ['value', parseInt],
  '276' : ['value', parseInt],
  '277' : ['value', parseInt],
  '278' : ['value', parseInt],
  '279' : ['value', parseInt],
  '280' : ['value', parseInt],
  '281' : ['value', parseInt],
  '282' : ['value', parseInt],
  '283' : ['value', parseInt],
  '284' : ['value', parseInt],
  '285' : ['value', parseInt],
  '286' : ['value', parseInt],
  '287' : ['value', parseInt],
  '288' : ['value', parseInt],
  '289' : ['value', parseInt],

  // Boolean flag value
  '290' : ['value', bool],
  '291' : ['value', bool],
  '292' : ['value', bool],
  '293' : ['value', bool],
  '294' : ['value', bool],
  '295' : ['value', bool],
  '296' : ['value', bool],
  '297' : ['value', bool],
  '298' : ['value', bool],
  '299' : ['value', bool],

  // Hard-pointer handle; arbitrary hard pointers to other objects within same DXF
  // file or drawing. Translated during INSERT and XREF operations
  '340' : ['pointer', hex],
  '341' : ['pointer', hex],
  '342' : ['pointer', hex],
  '343' : ['pointer', hex],
  '344' : ['pointer', hex],
  '345' : ['pointer', hex],
  '346' : ['pointer', hex],
  '347' : ['pointer', hex],
  '348' : ['pointer', hex],
  '349' : ['pointer', hex],

  // Lineweight enum value (AcDb::LineWeight).
  // Stored and moved around as a 16-bit integer.
  // Custom non-entity objects may use the full range,
  // but entity classes only use 371-379 DXF group codes in
  // their representation, because AutoCAD and AutoLISP both
  // always assume a 370 group code is the entity's lineweight.
  // This allows 370 to behave like other “common” entity fields
  '370' : ['value', parseInt],
  '371' : ['value', parseInt],
  '372' : ['value', parseInt],
  '373' : ['value', parseInt],
  '374' : ['value', parseInt],
  '375' : ['value', parseInt],
  '376' : ['value', parseInt],
  '377' : ['value', parseInt],
  '378' : ['value', parseInt],
  '379' : ['value', parseInt],

  // PlotStyleName type enum (AcDb::PlotStyleNameType).
  // Stored and moved around as a 16-bit integer.
  // Custom non-entity objects may use the full range, but entity classes
  // only use 381-389 DXF group codes in their representation, for the
  // same reason as the Lineweight range above
  '380' : ['value', parseInt],
  '381' : ['value', parseInt],
  '382' : ['value', parseInt],
  '383' : ['value', parseInt],
  '384' : ['value', parseInt],
  '385' : ['value', parseInt],
  '386' : ['value', parseInt],
  '387' : ['value', parseInt],
  '388' : ['value', parseInt],
  '389' : ['value', parseInt],
}

var count  = 0
processors.HEADER = function(line) {
  if (pairWise) {
    switch (line) {
      case '9':
        header && collect.push(header)
        header = {};
      break;
    }

    if (valueMap[line]) {
      last = valueMap[line];
    }
  } else {
    if (!last) {
      console.log('miss', line, count);
      process.exit();
    } else if (typeof last[1] === 'function') {
      header[last[0]] = last[1](line);
    } else {
      header[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};



fs.createReadStream(file)
  .pipe(split()).on('data', function(line) {
    line = line.trim();

    if (line.toLowerCase().indexOf('endsec') < 0) {
      current.push(line);

      if (current.length > 4) {

        if (processors[current[3]]) {
         processors[current[3]](line);
        }
      }



    } else {
      found.push(current);
      current = [];
    }

  }).on('end', function() {
    console.log(collect);
    //console.log(found, found.length, found.map(function(i) { return i[3] }));
  })


//   .pipe(through(function(line) {
//     var trimmed = line.trim();
//     if (trimmed[0] === '$') {
//       mode = 1;
//       key = trimmed.substr(1);
//       current = out.settings;
//       current[key] = [];
//       return;
//     } else if (!trimmed.match(/^\d/)) {
//       mode = 0;
//     }

//     switch (mode) {
//       case 1:
//         current[key].push(parseFloat(trimmed));
//       break;
//       default:
//         console.log('miss', line);
//       break;
//     }

//   })).on('end', function() {
//     console.log(  out);
//   })



