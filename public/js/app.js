import * as d3 from "https://cdn.skypack.dev/d3@7"

const faces = {
  "Volk,HD":"img/volk.png",
  "Reinke,P":"img/reinke.png"
}
let currentYear=2019;
const yearRange = [1983,2021]

const yearSelector = d3.select("input#year")
  .property("min", yearRange[0])
  .property("max", yearRange[1])
  .property("value", currentYear)


d3.select("#current-year").text(currentYear);

yearSelector
  .on("change", function (e) {
    e.preventDefault();
    let currentYear = yearSelector.property("value")
    console.log(currentYear);
    d3.select("#current-year")
      .text(currentYear)
  })

/*=================SCALES=======================*/
const scale = d3.scaleOrdinal(d3.schemeCategory10);
const color = d => scale(d.group);

const minPower = 20;
const maxPower = 3000;

/*=================DOM ELEMENTS=======================*/
const svg = d3.select("svg#map");
const height = 600;
const width = 960;

const linkG = svg.append("g")
  .attr("id", "link")
  
const nodeG = svg.append("g")
  .attr("id", "node")
  .attr("stroke", "#fff")
  .attr("stroke-width", 1.5)

const labelG = svg.append("g")
  .attr("id", "label")


const imgG = svg.append("g")
  .attr("id", "img")


/*=================Update function=======================*/
const updateMap = data => {
  
  // create the links and nodes from the
  let links = data.edges.map(d => Object.create(d));

  // remove the lowest 2% of links
  let weightRange = d3.extent(links, d => d.weight)
  //onsole.log(weightRange);
  links = links.filter(d => d.weight > weightRange[1] / 50)
  //console.log(d3.extent(links, d => d.weight));
  const nodes = data.nodes.map(d => Object.create(d));


  let powerRange = d3.extent(nodes, d => d.power);

  let powerScale = d3.scalePow()
    .exponent(.5)
    .clamp(true)
    .domain([powerRange[0], maxPower])
    .range([5,74])

  let labelScale = d3.scalePow()
    .exponent(.5)
    .clamp(true)
    .domain([powerRange[0], maxPower])
    .range([5,50])

  let distScale = d3.scaleSqrt()
    .domain([1,50])
    .range([200, 10])


  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-15))
    .force("center", d3.forceCenter(width / 2, height / 2).strength(1))
    .force("collide", d3.forceCollide().radius(d=>powerScale(d.power)*1.4));

  const link = linkG
    .selectAll("line")
    .data(links)
    .join("line")
      .attr("stroke-width", d => Math.sqrt(d.weight));


  const node = nodeG
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", d => powerScale(d.power))
      .call(drag(simulation))

  node
    .append("title")
    .text(d => d.name);

  const label = labelG
    .selectAll("text")
    .data(nodes)
    .join("text")
      .text(d => d.name)
      .classed("hidden", d => d.power < minPower)
      .attr("font-size", d => labelScale(d.power))
      
      //.text(d => (d.name === "Volk,HD") ? "" : d.name)

  const img = imgG
    .selectAll("image")
    .data(nodes.filter(d => ["Volk,HD", "Reinke,P"].includes(d.name)))
    .join("image")
      .call(drag(simulation))
      .attr("href", d => faces[d.name])
      .attr("width", d => powerScale(d.power) * 2)
      .attr("height", d => powerScale(d.power) * 2)

  
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

/*=================UPDATE=======================*/

function updateAll(year) {
  let url = `./data/pubmap/pubmap${year}.json`
  console.log(url)
  d3.json(url)
    .then(updateMap)
}




updateAll(currentYear);