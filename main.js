import Graph from "graphology";
import Sigma from "sigma";

import forceAtlas2 from "graphology-layout-forceatlas2";
import force from "graphology-layout-force";
import circlepack from "graphology-layout/circlepack";
import random from "graphology-layout/random";
import ForceAtlas2Worker from "graphology-layout-forceatlas2/worker";
import ForceSupervisor from "graphology-layout-force/worker";
import net_graph from "./net_graph.json";
import drawEdgeLabel from "sigma/rendering/canvas/edge-label";

const graph = new Graph();

const BEST_N_EDGES = 25;

net_graph.nodes.forEach((node) => {
  graph.addNode(node.label, {
    value: node.job_count,
    size: Math.log10(node.job_count) / Math.log10(1.9),
    label: `${node.label} (${node.job_count})`,
  });
});

net_graph.edges.forEach((edge) => {
  graph.addEdge(edge.from, edge.to, {
    value: edge.value,
    label: `${edge.from} -> ${edge.to} (${edge.value})`,
  });
});

graph.forEachNode((node, attr) => {
  const nodeEdges = [];
  graph.forEachNeighbor(node, (neighbor, attr) => {
    graph.findEdge(node, neighbor, (edge, attr) => {
      nodeEdges.push({ neighbor, value: attr.value });
    });
  });
  nodeEdges.sort((a, b) => b.value - a.value);
  nodeEdges.slice(BEST_N_EDGES).forEach((edge) => {
    try {
      graph.dropEdge(node, edge.neighbor);
    } catch (e) {}
  });
});

circlepack.assign(graph, {
  hierarchyAttributes: ["degree", "community"],
  scale: 20,
});

const layout = new ForceAtlas2Worker(graph, {
  iterations: 100,
  settings: {
    barnesHutOptimize: true,
    gravity: 10,
    scalingRatio: 10000,
    slowDown: 10,
    linLogMode: true,
    edgeWeightInfluence: 1,
  },
});

const container = document.getElementById("app");
container.style.height = "90vh";
container.style.width = "100vw";
const loadingDiv = document.getElementById("loading");
const loadingBarSpan = document.getElementById("loading-bar");

const startTime = Date.now();
layout.start();
loadingDiv.style.display = "flex";

setTimeout(() => {
  layout.stop();
  loadingDiv.style.display = "none";
}, 5000);
let id = setInterval(() => {
  const timePassed = Date.now() - startTime;
  const progress = timePassed / 5000;
  loadingBarSpan.innerHTML = `${Math.round(progress * 100)}%`;
  if (progress >= 1) {
    loadingDiv.style.display = "none";
    clearInterval(id);
  }
}, 300);

const renderer = new Sigma(graph, container, {
  minCameraRatio: 0.02,
  maxCameraRatio: 10,
});

function resetAndHighlightNode(nodeId) {
  graph.updateEachNodeAttributes(function (node, attr) {
    if (node === nodeId) {
      return { ...attr, color: "#00f", size: attr.size * 2 };
    }
    return {
      ...attr,
      color: "#a9a9a9",
      size: Math.log10(attr.value) / Math.log10(1.9),
    };
  });
  graph.updateEachEdgeAttributes(function (edge, attr, source, target) {
    if (source === nodeId || target === nodeId) {
      return { ...attr, color: "#f001" };
    }
    return { ...attr, color: "#d3d3d311" };
  });
  const edgesOfNode = graph.filterEdges((edge, attrs, source, target) => {
    return source === nodeId || target === nodeId;
  });
  edgesOfNode.forEach((edge) => {
    let attribs = graph.getEdgeAttributes(edge);
    let source = graph.source(edge);
    let target = graph.target(edge);
    graph.dropEdge(edge);
    graph.addEdgeWithKey(edge, source, target, {
      ...attribs,
      color: "#f00",
      size: 3,
    });
  });

  const neighborKeys = graph.neighbors(nodeId);
  neighborKeys.forEach((neighbor) => {
    graph.updateNodeAttribute(neighbor, "color", () => "#f00");
    graph.updateNodeAttribute(
      neighbor,
      "size",
      () => graph.getNodeAttribute(neighbor, "size") * 1.2
    );
  });
}

renderer.on("clickNode", (e) => {
  const nodeId = e.node;

  resetAndHighlightNode(nodeId);

  renderer.refresh();
});

const inputElem = document.getElementById("input");
const searchBtn = document.getElementById("search-button");
const optionsAreaDiv = document.getElementById("options");

searchBtn.addEventListener("click", () => {
  const input = inputElem.value;
  const nodes_matching_input = [];
  for (let i = 0; i < graph.order; i++) {
    const node = graph.nodes()[i];
    if (node.includes(input)) {
      nodes_matching_input.push(node);
    }
    if (nodes_matching_input.length >= 10) {
      break;
    }
  }

  optionsAreaDiv.innerHTML = "";
  nodes_matching_input.forEach((node) => {
    const nodeBtn = document.createElement("button");
    nodeBtn.innerHTML = node;
    nodeBtn.addEventListener("click", () => {
      resetAndHighlightNode(node);
      renderer.refresh();
    });
    optionsAreaDiv.appendChild(nodeBtn);
  });
  if(nodes_matching_input.length === 0){
    optionsAreaDiv.innerHTML = `
    :( No results found`;
  }
});
