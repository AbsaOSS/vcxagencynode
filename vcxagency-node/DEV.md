# Dev
If you would like explore the code or contribute, here's few concept the agency is built upon.
 
## Entities
The agency is build around concept of Entity. Agency contains few different types of entities. Let's first look
at characteristics of an Entity.

### Entity definition

- Entity has DID (EntityDID, E-DID)
- Entity has Vkey (EntityVkey, E-Vkey)
- Entity is addressable by DID and by Vkey
- Entity has wallet
- Entity can be read/written using Entity Access Object (AO)
- AO can be be restored from Entity Record
- Entity Record is generated upon initial creation of Entity data.

### Entity types

- Forward Agent is entity (FWA)
- Agent is entity
- Agent-Connection is entity 

#### Entity Forward Agent (FWA)

- Represents the Agency itself
- Secure initial communication with Agency
- Provides point of creating Agent in Agency 
- There is only 1 Forward Agent entity

#### Entity Agent

- Agent is the "Account" a client creates in Agency. Basically mailbox accepting messages on client's behalf.
- Agent can create entities of Agent-Connection type. It represent pairwise connection with 3rd party.
- Agent knows EntityDIDs of its Agent Connections
- Agent knows UserPairwiseDid of its Agent Connections


#### Entity Agent-Connection

- Agent-Connection represent mailbox for pairwise connection with a 3rd party.
- Agent-Connection knows EntityDID of Agent it belongs to.
- Agent-Connection has associated UserPairwiseVKey. Agent-Connection owner must use UserPairwiseVKey to communicate with this entity. 
- Agent-Connection has associated UserPairwiseDID. It is how Agent-Connection owner identifies the pairwise connection with 3rd party.


## Capabilities

### Entity Agent
- Agent can retrieve messages across all its connections. Message store must require AgentDID for any message retrieval.
- Agent can retrieve messages by Agent-Connection's UserPairwiseDIDs.
