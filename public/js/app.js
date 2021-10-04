import * as d3 from "https://cdn.skypack.dev/d3@7"

const faces = {
  "Volk,HD":"img/volk.png",
  "Reinke,P":"img/reinke.png"
}

const info_json = "./data/pubmap/pubmap_info.json"


// run the entire thing based on the info json
d3.json(info_json)
  .then(init)

function init(stats) {

  // retrieve the info data
  const yearRange = stats['year'];
  let currentYear=yearRange[0];
  console.log(stats)

  const yearSelector = d3.select("input#year")
  .property("min", yearRange[0])
  .property("max", yearRange[1]+2)
  .property("value", currentYear)
  .on("change", function (e) {
    e.preventDefault();
    currentYear = yearSelector.property("value")
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
  }, 2500)
  
  
  /*=================SCALES=======================*/
  // apply if groups are set via affiliations
  // const scale = d3.scaleOrdinal(d3.schemeCategory10);
  // const color = d => scale(d.group);
  
  /*=================DOM ELEMENTS=======================*/
  const svg = d3.select("svg#map");
  const height = 600;
  const width = 960;
  const centerX = width / 2;
  const centerY = height / 2;

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
  
  /*=================Scales=======================*/
  // get globals for the scaling
  // set maxPower below the actual maximum power to make VH and RP comparable
  let maxPower = 2800;
  let maxWeight = stats['links']['max'];
  console.log(maxWeight);
  let powerScale = d3.scalePow()
      .exponent(.75)
      .clamp(true)
      .range([5,74])
  
  let labelScale = d3.scalePow()
      .exponent(.5)
      .clamp(true)
      .range([5,50])
  
  // scale for weight
  let distScale = d3.scaleSqrt()
      .range([60, 20])

  let strengthScale = d3.scaleLinear()
      .range([0.2,1])

  const linkDist = (d) => distScale(d.weight) + powerScale(d.source.power) + powerScale(d.target.power);

  const simulation = d3.forceSimulation()
    .velocityDecay(0.5)
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(centerX, centerY)
      .strength(0.05))
    .force("link", d3.forceLink().id(d => d.id))
    .force("collide", d3.forceCollide())
  /*=======================================================*/
  /*=================Update function=======================*/
  function updateMap({nodes, edges, info}) {
    
    /*=================Update data=======================*/
    // store the existing data to preserve 
    const oldNodes = new Map(node.data().map(d => [d.id, d]));
  
    // create the links and nodes from the data
    // here assign the x and y coordinates for entering nodes in {}
    nodes = nodes.map(d => Object.assign(oldNodes.get(d.id) || {
      "x": Math.random() * width, 
      "y": Math.random() * height
    }, d));

    console.log(info);
    edges = edges.map(d => Object.assign({}, d));
  
    // let weightCutoff = d3.extent(edges, d => d.weight)[1] / 50;
    // weightCutoff = 0;
    // // remove the lowest 2% of links
    // edges = edges.filter(d => d.weight > weightCutoff);
    //console.log(d3.extent(links, d => d.weight));
  
  /*=================Update scales=======================*/
    let minPower = info['nodes']['min']
    powerScale.domain([minPower, maxPower]);
    labelScale.domain([minPower, maxPower]);
    distScale.domain([stats['links']['min'],maxWeight]);
    strengthScale.domain([info['links']['min'], maxWeight])

    simulation.alphaTarget(0.50).restart();
    simulation.nodes(nodes);
    simulation.force("charge").strength(-.5 * info['nodes']['count']);
    simulation.force("link")
      .links(edges)
      .distance(d => linkDist(d))
      .strength(d => strengthScale(d.weight));
    simulation.force("collide").radius(d=>powerScale(d.power)*0.8);



    let powerCutoff = info['nodes']['75%']
    let weigthCutoff = info['links']['50%']
    console.log(powerCutoff);
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

    link = link
      .data(edges, d => d.id)
      .join(
        enter => enter
          .append("line")
            .attr("stroke-width", 0)
            .attr("opacity",0)
          .transition()
          .duration(750)
            .attr("stroke-width", d => d.weight / 5)
            .attr("opacity", 1),
          update => update
            .attr("stroke-width", d => d.weight / 5),
          exit => exit
            .transition()
              .duration(550)
              .attr("opacity",0)
            .remove()
        )
    img = img
    .data(nodes.filter(d => ["Volk,HD", "Reinke,P"].includes(d.name)), d => d.id)
    .join(
      enter => enter
        .append("image")
          .call(drag(simulation))
          .attr("href", d => faces[d.name])
          .attr("width", d => powerScale(d.power) * 2)
          .attr("height", d => powerScale(d.power) * 2),
      update => update
        .transition()
        .duration(500)
        .attr("width", d => powerScale(d.power) * 2)
        .attr("height", d => powerScale(d.power) * 2)
    ) 


    node = node
      .data(nodes, d => d.id)
      .join(
        enter => enter
          .append("circle")
            .attr("r", 0)
            .attr("opacity", 0)
            .call(drag(simulation))
          .transition()
            .duration(750)
            .attr("opacity", 1)
            .attr("r", d => powerScale(d.power)),
        update => update
        .transition()
        .duration(500)
        .attr("r", d => powerScale(d.power)),
        exit => exit
          .transition()
            .duration(500)
            .attr("r", 0)
            .attr("opacity", 0)
            .remove()
        )

    label = label
      .data(nodes.filter(d => d.power > powerCutoff && !["Volk,HD", "Reinke,P"].includes(d.name)), d => d.id)
      .join(
        enter => enter
          .append("text")
            .text(d => d.name)
            .attr("opacity", 0)
          .transition()
            .duration(500)
            .attr("opacity",1)
        )
        .attr("font-size", d => labelScale(d.power))


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

