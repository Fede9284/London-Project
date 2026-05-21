# GNN Concepts in Finance

Based on the contents of the `GNN in Finance` folder (specifically the `GNN_Temporal_Networks_Tutorial.ipynb` and lecture notes), here is an overview of the key concepts used for building Graph Neural Network (GNN) models in financial environments (like PaySim, BankSim, and the Czech financial datasets).

## 1. Message Passing (The Underlying Framework)
The foundational concept in all GNNs is **message passing**, where nodes update their internal states (embeddings) by systematically aggregating information (messages) from their direct neighbors in the network. This localized aggregation allows the model to learn structural properties and relationships.

## 2. The Simplest GNN: PageRank
The simplest algorithmic instantiation of a GNN concept in this coursework is **PageRank**. 
As highlighted in the tutorial:
- PageRank assigns each node a stationary visit probability under a random walk with teleportation.
- The standard PageRank iteration can be mathematically rewritten as a **one-channel, weight-free, message-passing GNN**. Structural iteration matches a GCN (Graph Convolutional Network) forward pass without learnable weights.

## 3. Graph Convolutional Networks (GCNs)
For more advanced, trainable models, a standard multi-layer **GCN** is developed from scratch.
- GCNs aggregate neighborhood features using normalized adjacency matrices.
- Combined with non-linear activation functions (like ReLU), they are highly effective for tasks like **unsupervised node clustering**—grouping accounts or transactions without labeled training data based strictly on interaction topology.

## 4. Temporal Graph Attention Networks (Temporal-GAT)
Financial data (like transaction streams) isn't just structural; it's highly time-dependent. To handle continuous, streaming transactions, more complex models add temporal concepts:
- **Temporal Motifs:** Examining short-scale temporal sequences or event combinations (e.g., 2-event motifs like immediate reciprocated transactions) to find baseline mesoscopic memory effects. 
- **Time Encoding (Bochner Encoding):** Converting continuous timestamps into mathematical vectors (trigonometric/Bochner time encoding) so the neural network inherently understands the magnitude of "delay" between transactions.
- **Sum-then-Attention:** Using an attention mechanism to weigh the importance of incoming neighborhood transactions. The attention weights are conditioned on both the node features and the encoded time interval since the event occurred. 

## Summary
If you are building your first model or trying to understand the baseline mechanics, **PageRank (viewed natively as a message-passing operation)** is the simplest and most accessible GNN concept. For practical dynamic financial transaction streams, building up to a **Temporal-GAT with continuous-time encoding** provides the most accurate reflection of reality.