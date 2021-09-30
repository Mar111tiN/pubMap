import * as d3 from "https://cdn.skypack.dev/d3@7"

const faces = {
  "Volk,HD":"img/volk.png",
  "Reinke,P":"img/reinke.png"
}

const info_json = "./data/pubmap/info.json"


// run the entire thing based on the info json
d3.json(info_json)
  .then(init)

function init(info) {

  // retrieve the info data
  const yearRange = info['year'];
  let currentYear=yearRange[0];
  console.log(info)

  const yearSelector = d3.select("input#year")
  .property("min", yearRange[0])
  .property("max", yearRange[1])
  .property("value", currentYear)
  .on("change", function (e) {
    e.preventDefault();
    currentYear = this.property("value")
    updateAll(currentYear);
    timer.restart()
  })

  d3.select("#current-year").text(currentYear);

  function updateAll(year) {
    d3.select("#current-year")
      .text(year)
    let url = `./data/pubmap/pubmap${year}.json`

    d3.json(url)
      .then(updateMap)
  }
  /*=================UPDATE=======================*/

  // init display
  updateAll(currentYear);
  
  // run the year ticker!!
  let timer = d3.interval(() => {
    updateAll(++currentYear);
    yearSelector.property("value", currentYear)
  }, 3000)
  
  
  /*=================SCALES=======================*/
  const scale = d3.scaleOrdinal(d3.schemeCategory10);
  const color = d => scale(d.group);
  
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
    .force("charge", d3.forceManyBody().strength(-25))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide())
  
  /*
  for each iteration:
    alpha += (alphaTargtt - alpha) * alphaDecay
    velocity -= velocity * velocityDecay
  
    velocityDecay(decay) represents athmospheric friction
  alpha values
    .alphaDecay()  
    
    

  FORCES:
    d3.forceCenter([x,y])
      .strength(0 < s < 1)  default = 1

    d3.forceCollide(d => d.r) # needs to be called after changes of radius
      .strength()
  */
  

  
  /*=================Scales=======================*/
  let maxPower = 3000;
  
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
  
  
  // const node_trans = node.transition()
  //   .duration(500)
  
  // const label_trans = label.transition()
  //   .duration(500)
    
  
  /*=======================================================*/
  /*=================Update function=======================*/
  function updateMap({nodes, edges, info}) {
    
    /*=================Update data=======================*/
    // store the existing data to preserve 
    const oldNodes = new Map(node.data().map(d => [d.id, d]));
  
    // create the links and nodes from the data
      // here assign the x and y coordinates for entering nodes in {}!!!
    // {"cx": width / 2, "cy": height / 2}
    nodes = nodes.map(d => Object.assign(oldNodes.get(d.id) || {}, d));
    edges = edges.map(d => Object.assign({}, d));
  
    // let weightCutoff = d3.extent(edges, d => d.weight)[1] / 50;
    // weightCutoff = 0;
    // // remove the lowest 2% of links
    // edges = edges.filter(d => d.weight > weightCutoff);
    //console.log(d3.extent(links, d => d.weight));
  
  /*=================Update scales=======================*/
    let powerRange = d3.extent(nodes, d => d.power);
  
    powerScale.domain([powerRange[0], maxPower])
    labelScale.domain([powerRange[0], maxPower])
  
    let minPower = d3.max(nodes, d => d.power) / 50;
    console.log(minPower);
    link = link
      .data(edges, d => d.id)
      .join(
        enter => enter
          .append("line")
            .attr("stroke-width", 0)
            .attr("opacity",0)
          .transition()
          .duration(250)
            .attr("stroke-width", d => Math.sqrt(d.weight))
            .attr("opacity", 1),
          update => update
            .attr("stroke-width", d => Math.sqrt(d.weight)),
          exit => exit
            .transition()
              .duration(550)
              .attr("opacity",0)
            .remove()
        )
  
    node = node
      .data(nodes, d => d.id)
      .join(
        enter => enter
          .append("circle")
            .attr("r", 0)
            .attr("opacity", 0)
          .transition()
            .duration(750)
            .attr("opacity", 1)
            .attr("r", d => powerScale(d.power)),
        update => update,
        exit => exit
            .transition()
            .duration(750)
              .attr("r", 0)
              .attr("opacity", 0)
            .remove()
        )
        .attr("r", d => powerScale(d.power))
        .call(drag(simulation))
  
    label = label
      .data(nodes, d => d.id)
      .join(
        enter => enter
          .append("text")
            .text(d => d.name)
            .attr("opacity", 0)
          .transition()
            .duration(500)
            .attr("opacity",1)
        )
        .classed("hidden", d => d.power < minPower)
        .attr("font-size", d => labelScale(d.power))
  
  
    img = img
      .data(nodes.filter(d => ["Volk,HD", "Reinke,P"].includes(d.name)), d => d.id)
      .join("image")
        .call(drag(simulation))
        .attr("href", d => faces[d.name])
        .attr("width", d => powerScale(d.power) * 2)
        .attr("height", d => powerScale(d.power) * 2)
  
    
    // apply the data-driven simulation
    // has to be in function scope as the power scales are adjusted based on 
    // data ranges --> change to global? 
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
    simulation.force("link").links(edges);
    simulation.alpha(1).restart();
    simulation.force("collide").radius(d=>powerScale(d.power)*1.3);
    return svg.node();
  }

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

