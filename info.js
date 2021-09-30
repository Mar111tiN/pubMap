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
  



// YEAR SELECTOR
function createYearSelector(info) {
  // retrieve the info data
  const yearRange = info['year'];

  return d3.select("input#year")
    .property("min", yearRange[0])
    .property("max", yearRange[1])
    .on("change", function (e) {
      e.preventDefault();
      updateAll(this.property("value"));
      timer.restart()
    })
}