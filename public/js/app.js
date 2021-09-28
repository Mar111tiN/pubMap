import * as d3 from "https://cdn.skypack.dev/d3@7"

const faces = {
  "Volk,HD":"img/volk.png",
  "Reinke,P":"img/reinke.png"
}
let currentYear=2000;
const yearRange = [1983,2021]

const yearSelector = d3.select("input#year")
  .property("min", yearRange[0])
  .property("max", yearRange[1])
  .property("value", currentYear)
  .on("change", function (e) {
    e.preventDefault();
    let currentYear = yearSelector.property("value")
    updateAll(currentYear);
  })

d3.select("#current-year").text(currentYear);

/*=================UPDATE=======================*/

function updateAll(year) {
  d3.select("#current-year")
    .text(year)
  let url = `./data/pubmap/pubmap${year}.json`
  console.log(url)
  d3.json(url)
    .then(updateMap)
}

updateAll(currentYear);

/*=================SCALES=======================*/
const scale = d3.scaleOrdinal(d3.schemeCategory10);
const color = d => scale(d.group);

const minPower = 20;
const maxPower = 3000;

/*=================DOM ELEMENTS=======================*/
const svg = d3.select("svg#map");
const height = 600;
const width = 960;

let link = svg.append("g")
    .attr("id", "link")
  .selectAll("line")

let node = svg.append("g")
    .attr("id", "node")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
  .selectAll("circle")

let label = svg.append("g")
    .attr("id", "label")
  .selectAll("text")

let img = svg.append("g")
    .attr("id", "img")
  .selectAll("image")

const simulation = d3.forceSimulation()
  .force("link", d3.forceLink().id(d => d.id))
  .force("charge", d3.forceManyBody().strength(-45))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collide", d3.forceCollide())


/*=================Scales=======================*/
let powerScale = d3.scalePow()
    .exponent(.5)
    .clamp(true)
    .range([5,74])

let labelScale = d3.scalePow()
    .exponent(.5)
    .clamp(true)
    .range([5,50])
let distScale = d3.scaleSqrt()
    .domain([1,50])
    .range([200, 10])

  
/*=======================================================*/
/*=================Update function=======================*/
function updateMap({nodes, edges}) {
  
  /*=================Update data=======================*/
  // create the links and nodes from the data
  let links = edges.map(d => Object.assign({}, d));

  let weightCutoff = d3.extent(links, d => d.weight)[1] / 50
  // remove the lowest 2% of links
  links = links.filter(d => d.weight > weightCutoff);
  //console.log(d3.extent(links, d => d.weight));
  const oldNode = new Map(node.data().map(d => [d.id, d]));
  console.log(oldNode);
  nodes = nodes.map(d => Object.assign(oldNode.get(d.id) || {}, d));

/*=================Update scales=======================*/
  let powerRange = d3.extent(nodes, d => d.power);

  powerScale.domain([powerRange[0], maxPower])
  labelScale.domain([powerRange[0], maxPower])

  link = link
    .data(links, d => [d.source.id, d.target.id])
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.weight));

  node = node
    .data(nodes, d => d.id)
    .join(enter => enter
      .append("circle")
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      )
      .attr("r", d => powerScale(d.power))
      .call(drag(simulation))

  node
    .append("title")
    .text(d => d.name);

  label = label
    .data(nodes, d => d.id)
    .join("text")
      .text(d => d.name)
      .classed("hidden", d => d.power < minPower)
      .attr("font-size", d => labelScale(d.power))
      
      //.text(d => (d.name === "Volk,HD") ? "" : d.name)

  img = img
    .data(nodes.filter(d => ["Volk,HD", "Reinke,P"].includes(d.name)), d => d.id)
    .join("image")
      .call(drag(simulation))
      .attr("href", d => faces[d.name])
      .attr("width", d => powerScale(d.power) * 2)
      .attr("height", d => powerScale(d.power) * 2)

  
  // apply the data-driven simulation 
  simulation.on("tick", () => {
    link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    label
        .attr("x", d => d.x)
        .attr("y", d => d.y + powerScale(d.power) + labelScale(d.power)-3);
    img
        .attr("x", d => d.x - powerScale(d.power))
        .attr("y", d => d.y - powerScale(d.power))
  });

  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.alpha(0.5).restart();
  simulation.force("collide").radius(d=>powerScale(d.power)*1.3);
  return svg.node();
}


/*=================DRAG======================*/
const drag = simulation => {

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  
  return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
}

