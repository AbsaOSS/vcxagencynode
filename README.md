# Node VCX Agency
- Implementation of [LibVCX](https://github.com/hyperledger/indy-sdk/tree/master/vcx) (V3 protocol) compatible Agency (more specifically 
[Mediator Agency](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0046-mediators-and-relays/README.md)
in Aries terminology).

- Mediator Agency can service many users, providing them endpoint where 3rd parties can deliver encrypted messages. 
Assuming the sending party has properly end2end encrypted the message for recipient, according to Aries connection  
protocol, the agency itself can't decrypt content of received messages.

# Repository structure
The agency implementation is in directory [vcxagency-node](./vcxagency-node).

Repository structure details:
```
/
├── dev/               # Monorepo management scripts
├── vcxagency-node /   # NodeJS VCX Agency implementation
├── vcxagency-client/  # Construction of VCX Client2Agency messages
├── easy-indysdk/      # NodeJS idiomatic wrapper around basic IndySDK wrapper
├-- vcx-tester/        # Agency integration tests using LibVCX
└── node-vcx-wrapper/  # Dependency used by vcx-tester/ 
```

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
