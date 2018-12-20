



function colormap_for_unique(values) {
    var colors = d3.scaleOrdinal(d3["schemeCategory20"]);
    var colormap = {};
    var i;
    var j = 0;
    for (i in values) {
	if (!(values[i] in colormap)) {
	    colormap[values[i]] = colors(j);
	    j++;
	}
    }
    return colormap;
}

function rgb_from_triple(rgb_str) {
    return rgb_str.match(/\d+/g).map(x => x / 255.0);
}

function rgb_from_hex(hex_str) {
    return [parseInt(hex_str.slice(1, 3), 16) / 255.0,
	    parseInt(hex_str.slice(3, 5), 16) / 255.0,
	    parseInt(hex_str.slice(5, 7), 16) / 255.0];
}

function rgb_to_css_str(r, g, b) {
    return "rgb(" + Math.round(r * 255) + "," + Math.round(g * 255) + "," + Math.round(b * 255) + ")";
}

function tf_add(filepath) {
    
    var file = document.querySelector('input[type=file]').files[0];
    if (file) {
	var s = filepath.split("\\");
	tf_name = s[s.length - 1];
	reader.onload = function () {
	    var tfs = d3.csvParse("TF\n" + reader.result);
	    trans_factors[tf_name] = {"TFs": tfs, "color": "#ff0000", "enabled": true};
	    update_tf_selection(trans_factors);
	    update_path_highlights(trans_factors, leaf_by_name, highlight_paths);
	};
	reader.readAsText(file);
    }
}

function replace_all_occurrences(str, match, replace) {
    var re = new RegExp(match);
    return str.replace(re, replace);
}

function clear_highlights(highlights) {
    for (var l of highlights.keys()) {
	var elem = d3.select(l.linkNode);
	elem.classed("highlight-link", false);
	elem.style("stroke", null);
	elem.style("stroke-opacity", null);
    }
}
// { linknode: { group_name1: {color: c, TFs: [tf1, tf2, ...]}, group_name2: { ... }}}
function populate_highlights(highlights, leaf_by_name, tfs) {
    Object.keys(tfs).forEach(function (k) {
	var val = tfs[k];
	if (val.enabled) {
	    var tf_color = rgb_from_hex(val.color);
	    val.TFs.forEach(function (tf) {
		//var tfname = tf.TF.replace(/\./g, "_");
		var tfname = tf.TF;
		if (tfname in leaf_by_name) {
		    var d = leaf_by_name[tfname];
		    do {
			var curr = highlights.get(d) ? highlights.get(d) : {};
			if (k in curr) {
			    curr[k]["TFs"].push(tfname);
			}
			else {
			    curr[k] = {"color": tf_color, "TFs": [tfname]};
			}
			highlights.set(d, curr);
			d = d.parent;
		    } while (d && d.linkNode);
		}
		else {
		    console.log("problem with " + tfname);
		}
		
	    });
	}
    });
}

function highlight_branches(highlights_paths) {
    for ([k, v] of highlight_paths) {
	var colors = [];
	var tot = 0.0;
	Object.keys(v).forEach(function (group) {
	    var vv = v[group];
	    var opacity = vv["TFs"].length / k.leaves().length;
	    var c = vv["color"];
	    colors.push([c[0], c[1], c[2], opacity]);
	    tot += opacity;
	});

	var color = [0.0, 0.0, 0.0, 0.0];
	colors.forEach(function (c) {
	    var mult = (c[3] / tot);
	    color[0] += mult * c[0];
	    color[1] += mult * c[1];
	    color[2] += mult * c[2];
	    color[3] = c[3] > color[3] ? c[3] : color[3];
	});
	
	d3.select(k.linkNode).style("stroke", rgb_to_css_str(color[0], color[1], color[2]))
	    .style("stroke-opacity", Math.max(0.1, color[3]))
	    .classed("highlight-link", true);
    }
}

function update_path_highlights(trans_factors, leaf_by_name, highlight_paths) {
    // Clear everything
    clear_highlights(highlight_paths);
    highlight_paths.clear();
    populate_highlights(highlight_paths, leaf_by_name, trans_factors);
    highlight_branches(highlight_paths);
}

function update_tf_selection(data) {
    var rows = tbody.selectAll("tr")
	.data(Object.keys(data))

    rows = rows.enter()
	.append("tr")

    rows.append("td")
	.append("input")
	.attr("type", "checkbox")
	.attr("checked", true)
	.on("change", function (tf_name) {
	    data[tf_name].enabled = this.checked;
	    update_path_highlights(data, leaf_by_name, highlight_paths);
	});
    
    rows.append("td")
	.attr("class", "name-col")
	.attr("id", function (tf_name) {
	    return "colorchooser-" + tf_name;
	})
	.text(function (tf_name) { return tf_name; });

    rows.append("td")
	.attr("class", "color-col")
	.append("input")
	.attr("name", "Color Picker")
	.attr("value", function (tf_name) { return data[tf_name].color; })
	.attr("type", "color")
	.on("change", function (tf_name, i) {
	    data[tf_name].color = this.value;
	    update_path_highlights(data, leaf_by_name, highlight_paths);
	});
    
    rows.exit().remove();

}

// Compute the maximum cumulative length of any node in the tree.
function maxLength(d) {
  return d.data.length + (d.children ? d3.max(d.children, maxLength) : 0);
}
// Set the radius of each node by recursively summing and scaling the distance from the root.
function setRadius(d, y0, k) {
  d.radius = (y0 += d.data.length) * k;
  if (d.children) d.children.forEach(function(d) { setRadius(d, y0, k); });
}
// Set the color of each node by recursively inheriting.
function setColor(d) {
  var name = d.data.name;
  d.color = color.domain().indexOf(name) >= 0 ? color(name) : d.parent ? d.parent.color : null;
  if (d.children) d.children.forEach(setColor);
}
function linkVariable(d) {
  return linkStep(d.source.x, d.source.radius, d.target.x, d.target.radius);
}
function linkConstant(d) {
  return linkStep(d.source.x, d.source.y, d.target.x, d.target.y);
}
function linkExtensionVariable(d) {
  return linkStep(d.target.x, d.target.radius, d.target.x, innerRadius);
}
function linkExtensionConstant(d) {
  return linkStep(d.target.x, d.target.y, d.target.x, innerRadius);
}
// Like d3.svg.diagonal.radial, but with square corners.
function linkStep(startAngle, startRadius, endAngle, endRadius) {
  var c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI),
      s0 = Math.sin(startAngle),
      c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI),
      s1 = Math.sin(endAngle);
  return "M" + startRadius * c0 + "," + startRadius * s0
      + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
      + "L" + endRadius * c1 + "," + endRadius * s1;
}
function zoomed() {
  chart.attr("transform", d3.event.transform);
}

function nchoosek (n, k) {
    var result = 1;
    for (var i = 1; i <= k; i++) {
	result *= (n + 1 - i) / i;
    }
    return result;
}

function hyper_test(N, K, n, k) {
    var c = nchoosek(N, n);
    //var a = nchoosek(K, k);
    //var b = nchoosek(N - K, n - k);
    var p = 0.0;
    for (var i = k; i <= K; i++) {
	var a = nchoosek(K, i);
	var b = nchoosek(N - K, n - i);
	p += (a * b) / c;
    }

    return p;
}

function fisher_exact_test (a, b, c, d) {
    var r = nchoosek(a + b, a);
    r *= nchoosek(c + d, c);
    r /= nchoosek(a + b + c + d, a + c);
    return r;
}


var outerRadius = 1500 / 2,
    innerRadius = outerRadius - 170;
var color = d3.scaleOrdinal()
    .domain(["Bacteria", "Eukaryota", "Archaea"])
    .range(d3.schemeCategory10);
var cluster = d3.cluster()
    .size([360, innerRadius])
    .separation(function(a, b) { return 1; });
var svg = d3.select("body").append("svg")
    .attr("width", outerRadius * 2)
    .attr("height", outerRadius * 2)
    .call(d3.zoom().on("zoom", zoomed));
var chart = svg.append("g")
    .attr("id", "chart-trans")
var tf_selector = d3.select("#tf_selection");

var reader = new FileReader();
var highlight_paths = new Map();
var tbody = d3.select("#tf-table")
    .append("tbody")
var trans_factors = {};
var root;
var leaf_by_name;

tf_selector.select("#tf-file-selector")
    .on("change", function () {
	tf_add(this.value);
    });

tf_selector
    .on("mouseover", function (e) {
	tf_selector.selectAll(".tf-hidden")
	    .transition(d3.transition().duration(200))
	    .style("opacity", 0.9)
	    .style("display", "");
	    
    });

tf_selector.on("mouseleave", function (e) {
    tf_selector.selectAll(".tf-hidden")
	.transition(d3.transition().duration(500))
	.style("opacity", 0)
	.style("display", "none");
});

// Load tree from json
d3.json("jaspar-vertibrates-tree_upgma.json", function(error, json) {
    if (error) throw error;
    
    d3.json("tf_info.json", function(error2, tf_info) {
	if (error2) throw error2;
	var name2jasparid = {}
	Object.keys(tf_info).forEach(function(k) {
	    name2jasparid[tf_info[k].name] = k;
	});
	var colormap = colormap_for_unique(Object.values(tf_info).map(x => x.family));
	
	root = d3.hierarchy(json, function(d) { return d.children; })
	    .sum(function(d) { return d.children ? 0 : 1; })
	    .sort(function(a, b) { return (a.value - b.value) || d3.ascending(a.data.length, b.data.length); });
	cluster(root);

	leaf_by_name = {};
	root.leaves().map(function (n) {
	    leaf_by_name[tf_info[n.data.name].name] = n;
	});
	
	setRadius(root, root.data.length = 0, innerRadius / maxLength(root));
	setColor(root);
	var use_branch_lengths = d3.select("#show-length-box").property("checked");
	var linkExtension = chart.append("g")
	    .attr("class", "link-extensions")
	    .selectAll("path")
	    .data(root.links().filter(function(d) { return !d.target.children; }))
	    .enter().append("path")
	    .each(function(d) { d.target.linkExtensionNode = this; })
	    .attr("d", (use_branch_lengths ? linkExtensionVariable : linkExtensionConstant));
	var link = chart.append("g")
	    .attr("class", "links")
	    .selectAll("path")
	    .data(root.links())
	    .enter().append("path")
	    .each(function(d) { d.target.linkNode = this; })
	    .attr("d", (use_branch_lengths ? linkVariable : linkConstant))
	    .attr("stroke", function(d) { return d.target.color; });
	chart.append("g")
	    .attr("class", "labels")
	    .selectAll("text")
	    .data(root.leaves())
	    .enter().append("text")
	    .attr("dy", ".31em")
	    .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + (innerRadius + 4) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); })
	    .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
	    .style("fill", function(d) { return colormap[tf_info[d.data.name].family[0]]; })
	    .style("font-size", "8px")
	    .text(function(d) { return tf_info[d.data.name]["name"]; })
	    .on("mouseover", mouseovered(true))
	    .on("mouseout", mouseovered(false))
	    .on("click", function(d) {
		do {
		    var elem = d3.select(d.linkNode);
		    elem.classed("link--red", !elem.classed("link--red"));
		    d = d.parent;
		} while(d && d.linkNode);
	    });

	function changed() {
	    //clearTimeout(timeout);
	    var t = d3.transition().duration(750);
	    linkExtension.transition(t).attr("d", this.checked ? linkExtensionVariable : linkExtensionConstant);
	    link.transition(t).attr("d", this.checked ? linkVariable : linkConstant);
	}
	function mouseovered(active) {
	    return function(d) {
		d3.select(this).classed("label--active", active);
		d3.select(d.linkExtensionNode).classed("link-extension--active", active).each(moveToFront);
		do d3.select(d.linkNode).classed("link--active", active).each(moveToFront); while (d = d.parent);
	    };
	}
	function moveToFront() {
	    this.parentNode.appendChild(this);
	}
	var input = d3.select("#show-length input").on("change", changed);
	
    })});
