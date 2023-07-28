# <span style="color:red;background:white">Decommission notice</span>
This project has been decommissioned. No further updates or maintenance shall be expected.

# Node VCX Agency
- Implementation of [AriesVCX](https://github.com/hyperledger/aries-vcx/) compatible 
[Mediator Agency](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0046-mediators-and-relays/README.md).

- Mediator Agency can service many users, providing them endpoint where 3rd parties can deliver encrypted messages. 
Assuming the sending party has properly end2end encrypted the message for recipient, according to Aries connection  
protocol, the agency itself can't decrypt content of received messages.

- VCX Agency implements 2 notification mechanisms. 
  1. Webhooks - The agency calls a specified url when an agent receives a message. This is useful when using 
     AriesVcx on a server.
  2. Longpolls - Agent owners can poll agency to check whether any new messages have arrived. This is implemented via 
     longpoll mechanism - the server returns response only if a new message has arrived, or certain amount of time has 
     passed since the query request was received. This is to prevent overloading agency with client requests.
     In the future, longpoll mechanism might be replaced by websockets.   
      

# Repository structure
The agency implementation is in directory [vcxagency-node](./vcxagency-node).

Repository structure details:
```
/
├── dev/               # Monorepo management scripts
├── vcxagency-node /   # AriesVCX mediator agency implementation in NodeJS 
├── vcxagency-client/  # AriesVCX mediator agency client in NodeJS 
├── easy-indysdk/      # NodeJS idiomatic wrapper around basic IndySDK wrapper
└-- vcx-tester/        # AriesVCX integration tests using AriesVCX
```

- Rust client for agency can be found [here](https://github.com/hyperledger/aries-vcx/tree/master/agency_client).

# Note
- Project is using `yarn` instead of `npm` to install dependencies in all modules. The reason is that 
`npm` has issues handling monorepo projects with `file:` style dependencies. 
See more info here https://github.com/npm/npm/issues/13528

---

    Copyright 2020 ABSA Group Limited
    
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
        http://www.apache.org/licenses/LICENSE-2.0
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
