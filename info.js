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

    Collision
    nodes are treated as circles with given radius

    d3.forceCollide() # needs to be called after changes of radius
      .radius(d => d.r)
      .strength(0 < s < 1)

    Link forces
  */
  
