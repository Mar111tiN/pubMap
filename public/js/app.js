import * as d3 from "https://cdn.skypack.dev/d3@7"

const faces = {
  "Volk,HD":"img/volk.png",
  "Reinke,P":"img/reinke.png"
}
const YEAR=2000;

const yearRange = [1983,2021]

function updateAll(year) {
  let url = `./data/pubmap/pubmap${year}.json`
  console.log(url)
  d3.json(url)
    .then(updateMap)
}

const yearSelector = d3.select("input#year")
  .property("min", yearRange[0])
  .property("max", yearRange[1])
  .property("value", YEAR)

yearSelector
  .on("change", function (e) {
    e.preventDefault();
    let currentYear = yearSelector.property("value")
    console.log(currentYear);
    d3.select("#current-year")
      .text(currentYear)
  })


const updateMap = data => {
  const height = 600
  const width = 960
  const scale = d3.scaleOrdinal(d3.schemeCategory10);
  const color = d => scale(d.group);

  const links = data.edges.map(d => Object.create(d));
  const nodes = data.nodes.map(d => Object.create(d));

  console.log(nodes)
  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-40))
    .force("center", d3.forceCenter(width / 2, height / 2))
    //.force("collide", d3.forceCollide().radius(d=>Math.sqrt(d.power)));

  const svg = d3.select("svg#map")

  const link = svg.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.weight));
      
  const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", d => Math.sqrt(d.power))
      .attr("fill", color)
      .call(drag(simulation));
  node.append("title")
    .text(d => d.name);

  const label = svg.append("g")
      .attr("font-size", "1.5em")
      .attr("text-anchor", "middle")
      .classed("label", true)
      .attr("stroke", "blue")
      .attr("stroke-width", "1px")
    .selectAll("text")
    .data(nodes)
    .join("text")
      .text(d => d.name)
      .attr("font-size", d => Math.sqrt(d.power))
      
      //.text(d => (d.name === "Volk,HD") ? "" : d.name)

  const img = svg.append("g")
      .classed("image", true)
    .selectAll("image")
    .data(nodes.filter(d => ["Volk,HD", "Reinke,P"].includes(d.name)))
    .join("image")
      .call(drag(simulation))
      .attr("href", d => faces[d.name])
      .attr("width", d => Math.sqrt(d.power) * 2)
      .attr("height", d => Math.sqrt(d.power) * 2)

  
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
        .attr("y", d => d.y + Math.sqrt(d.power) * 2 - 10);
    img
        .attr("x", d => d.x - Math.sqrt(d.power))
        .attr("y", d => d.y - Math.sqrt(d.power))
  });
  return svg.node();
}

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

updateAll(YEAR)