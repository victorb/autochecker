describe Integer do
  it "2.3 Hash comparison" do
    expect({ x: 1, y: 2 } >= { x: 1 }).to eql(true)
    expect({ x: 1, y: 2 } >= { x: 2 }).to eql(false)
    expect({ x: 1 } >= { x: 1, y: 2 }).to eql(false)
  end
end

