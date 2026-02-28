import json
import plotly.graph_objects as go
import plotly.io as pio

# Use browser to render the figure (avoids notebook dependency)
pio.renderers.default = 'browser'

# Load your data file
with open("data.json") as f:
    data = json.load(f)

# Extract packedItems array
packed_items = data["packingResults"][0]["visualLayout"]["packedItems"]

# Initialize 3D figure
fig = go.Figure()

# Add one 3D box per item
for item in packed_items:
    pos = item["position"]
    dim = item["dimensions"]
    x, y, z = pos["x"], pos["y"], pos["z"]
    l, b, h = dim["length"], dim["breadth"], dim["height"]

    # Vertices of the box (8 corners)
    fig.add_trace(go.Mesh3d(
        x=[x, x+l, x+l, x, x, x+l, x+l, x],
        y=[y, y, y+b, y+b, y, y, y+b, y+b],
        z=[z, z, z, z, z+h, z+h, z+h, z+h],
        i=[0, 0, 0, 7, 6, 5, 1, 2, 3, 4, 1, 2],
        j=[1, 2, 3, 6, 5, 4, 5, 6, 7, 7, 0, 3],
        k=[2, 3, 0, 5, 4, 7, 6, 7, 4, 0, 1, 2],
        color='orange',
        opacity=0.4,
        flatshading=True
    ))

# Set 3D scene layout
fig.update_layout(
    scene=dict(
        xaxis_title='X',
        yaxis_title='Y',
        zaxis_title='Z',
        aspectmode='data'
    ),
    title='3D Box Layout from packedItems',
    margin=dict(l=0, r=0, t=40, b=0),
)

# Show the 3D plot
fig.show()
