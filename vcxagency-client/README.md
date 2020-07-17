# VCX Agency client
NodeJS implementation of VCX Agency client implementing Client2Agency LibVCX protocol V3. 

In a typical application, you'll likely use LibVCX library as an Agency client - a user friendly way to communicate 
with agency and process received messages.

This client on the other hand, does not define how to process messages, handle connections, but it provides granular
access to LibVCX Agency API.  
 
 # VCX Client2Agency Protocol
VCX agency protocol message types can be grouped into few areas:
- Onboarding
- Downloading/Updating messages owned by cloud agent
- Downloading messages of cloud agent's particular connection
- Internal agency forwarding

# Messages examples

## VCX Agent Onboarding

- Creating new cloud agent in agency
```
AgencyComm outbound: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CONNECT","fromDID":"LC9mkrzZfDXb3UwjnBnm89","fromDIDVerKey":"BThuVSUpiDnL73c4SaUopzXsPE7fN5iwzjQahH5ov4Ag"}
AgencyComm Inbound agency_v2: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CONNECTED","withPairwiseDID":"XSasL1cESeSJ2v9wMYeXBf","withPairwiseDIDVerKey":"HbJb8uKp4mtjhnNknP66GgmUMYta6XArNaA4WJDEyyv9"}

AgencyComm outbound: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/SIGNUP"}
AgencyComm Inbound agency_v2: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/SIGNED_UP"}

AgencyComm outbound: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/CREATE_AGENT"}
AgencyComm Inbound agency_v2: {"@type":"did:sov:123456789abcdefghi1234;spec/onboarding/1.0/AGENT_CREATED","withPairwiseDID":"DnEpUQJLupa5rKPkrKUpFd","withPairwiseDIDVerKey":"7y118tRW2EMJn18qs9MY5NJWYW2PLwV5QpaLyfoLHtgF"}
```

## Create pairwise connection on Agent
- VCX Client can have relationships (connections) with many parties. For each of these connections, the client needs
  to create specialized "Connection Agent" which collects messages sent from connection counterparty.
  
  This messages creates such specialized agent.
```
AgencyComm Outbound: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/CREATE_KEY","forDID":"6FRuB95abcmzz1nURoHyWE","forDIDVerKey":"3rvcQRYr1PWwVyTskZg2RQiWeDitKWjiK8bkGHNZoWh8"}
AgencyComm Inbound V2: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/KEY_CREATED","withPairwiseDID":"6s2aY8eCjgFHzWJgFSe8Si","withPairwiseDIDVerKey":"4CKvy3vU4jPtWGDeBCx5tE1Rwb8zYXJQWBBEUHEzxEg6"}
```

## Get messages
- VCX Client can download messages from a Connection Agent, hence download messages for particular relationship.
```
AgencyComm Outbound (for agent T2uoL8oavjWYVqWMTfXfVc): [{"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/GET_MSGS","statusCodes":["MS-103"]}]
AgencyComm Inbound V2: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS","msgs":[{"payload":{"ciphertext":"AQSZ1QWvVZibDAp5uJyeamSn-Jj_yDekElpXIgSDnx3xOVQMjNGrPtPt07sH0IX3vK532hNpXGLtmmUm5_3ScXwSKg-DqghbYvbdOF_-_hWz6nhn3wDp3kx-50b8Mcs_6ih6jDMTLG01u3J3B5usbiVljNZzhelgDnpHXt2Sknof_0t0i8LgTvnKtfQxAl2DjLfUpD2K50MnRyN1_rZnUB8AyRVF-FXZUkTsPpO8Y3WWVRU_ckpVwhiIQf9h4Z8zORsYJQ-mVWmqqkcOGFt3un39Rw_wt80ULsbDMzEqUJ3Y255Gw6ZB576ZJK3vaxCuGt6aFPDx9dv_vWgLRLZq0W5mTe2v2hPeR9FMSpzV4OcGTplapLoc307Jzlz2bufEEeuvtxAJFF8ymmA6nGWKtR85G6rWKHFT4dh68nXRc5hZcd0_EpYRpd1LQvqqXhzZRWhTRVQ0hjkWlPw4outChR75N1COgAr0-2Ymwaqpg5UtN57-X0y6Ab9Z3-8r0pBCCzkQ1mWJ2vh_6n143ISIhyitKdWp3xLDJy27EOq2RK-zKby-HOg1woA4FmDuAHWo6VOsfrlb7qYKy__Wms8IT6INIehU6UKGpixIoXBOFp2Ue7--Yv76dwgDmcA6A8dUyz_T3YHhwR7-gquvEEw1w21h75vLpEUAWp3M9PIilOF4y8xtqP_1xuVohASHREwCRYkehiX0aqYLYJZxkHRJihjeW7eLzNu5S6Aa08L6lwj6naqKZi5ybsWJEqPPivqo2hU9b3rePKhLgdGobQxBS_RJ9CQP3Y1EbSmCyjQ1tYlmpKhn6tvxC6kzzTZ_zOVTUwxzzWPDU2ugDQ_1uKUSDBfH1sMX3WOzT4MkkpGbyUt1lUqaKGDoT72C_mNif75JloQnG5zUABeZZs-Ljbk_w15ZiC-TJrcNNNBsYTHPdpzpJwaI6kmmUoM0T_hg7volOcznLsBNs263179fW9MaJHfeJqbot8ksS0WpHt3JvtAYhz4e-7nxC9MVxeI7WvB3EBwqS3cm_GQ9VAX_Yz3LGc7pGHib10IeLERHD3m3gNFKAwPlC0HwRnpQ7AL4lOjojNMrKUrEeen8RJzv1HNhOHtMSEh-zPjExttGAedcUD8O8hbju3jKsqhF9Hamw5EZES8CD_jYmW_XKzMyuZveDyvXMSlwH642RMfmm2PrFAox8DmsTq4yb8YM2SkHLSI1w_EWir9LbRlNS8wAI7P5wqMgZIBLegVgUZzlob3HqXrSDnQIF2xl64884HHywiHBFI_y6Ob5VRCvAbYfV_QwOTfNssvt2dxSVvxui8BfCotJUzEaCiMcbf97S-OI-bwBdGnZ4NlmCeX9PWSkRoDBRsmjWgnA9nLTz4RqXMC5Uc-1RkdNOBd11dp6sr-n8ACcuf8xDI9aCNZyO1cliAkmxirkoZmQ--ZZcSdre6A_E7JXtaNLiR0bzZmyHwqZL6VsCAIae-LmdzGaWe-3TGZVxe7z1O5bw3L0bwCiaCE3I82fLxOv8uVtd6eGqFQCs7KCb1zb8_1qm1F9WVHizB3YGr4899J6UJAMopcwDgunn8P-nJ4qK3tsE4DMJ4BrYxJf-IST2DbtKU50ls6Z2wZ64tP8FA2zmMOU9eJP8ZCtAsCTc6Pi1s0NJhEoJkbYsZvECAky9hNoR0Zaw7njl-qYHCz1tADxC17mfgm0f6lg1P44s6IqAxPJgwSkGJ-izw6H3c95i9Eh65WNGSJGQAHYD8YmfFUkwGtiV2fLye823zS8c-3j2jmbBgaUBa40X5FQSA8D-vg1i8g8gjivjat4zVVPd-l0rAoN5ztIfsChmgugzmyEqAHnVmi1_uh04Icvt1mq2_jIroKmn3VHyL1AaIOb888UZdo=","iv":"yvhEfEaR-Ttc3Z7c","protected":"eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkF1dGhjcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiJId2dMeUs1UzlTdElaLUtENzA2NW92Q3Vad0EtZmx3NXdMazduNXo2UjlDR2JmbzA2QnE1Wk9zVnU3LTVobkN5IiwiaGVhZGVyIjp7ImtpZCI6IkI5RmY4WTRQcTFTZkRiMVJTdnNBMVJEM2I3Vjg5ZUc5R3g5QUFycHE5eWFyIiwiaXYiOiJLOEJPYVJVaGxUTTk0Y2tkQ2RMeHNyTkh2TTlWNnpKNSIsInNlbmRlciI6IlQ1ZkFQWnRrYzJ3ZWo2dkk5ejJuU2dUM3pXOFRpVDJiMnNEQk4wMHZaakhYXzJ5T2FucVZlVkdxOXB0Z2NhMEZKSzBrak90bW1hVDhKRlpubnpaa0VfNXd3bnZjTVh6VGVFaDJHUzZhZzNJekJ6SDcxU1Q2Y3Q2QTFPVT0ifX1dfQ==","tag":"jsRfDwWu-7fQ8FVbhmT7og=="},"refMsgId":null,"senderDID":"","statusCode":"MS-103","type":"aries","uid":"34GGIOJufL"}]}
```

## Update connection status
- VCX Agency stores messages received by cloud agents. With each message it also stores some metadata. One
  particular piece of this metadata is `statusCode` - a flag signalling whether (or how) was given message
  processed. It's VCX Client's responsibility to maintain message status codes and correctly interpret their
  meaning. 
  
  This message type updates status code on specified messages to new value. 
```
AgencyComm Outbound: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/UPDATE_MSG_STATUS_BY_CONNS","statusCode":"MS-106","uidsByConns":[{"pairwiseDID":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}]}
AgencyComm Inbound V2: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS","failed":[],"updatedUidsByConns":[{"pairwiseDID":"6FRuB95abcmzz1nURoHyWE","uids":["Br4CoNP4TU"]}]}
```

## Get messages by connection
- Agent is aware of all its Connection Agents. This message tells Agent to retrieve messages across for
  ConnectionAgents selected according to specified filters.
```
AgencyComm Outbound (for agency 5Sy4H2ueJLKwZzLpxcyzxV): {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/GET_MSGS_BY_CONNS","uids":["n7r26S1GKT"],"statusCodes":["MS-102","MS-103","MS-104","MS-105","MS-106"],"pairwiseDIDs":["KSuQ4ezTQMX8NaBokRB4Bk"]}
AgencyComm Inbound V2: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSGS_BY_CONNS","msgsByConns":[{"msgs":[{"payload":{"ciphertext":"CA85w94M9sE9691oD1HS9RWBCCbPguXnwwXEeUXjVpAWvkA_qc8e8YR2khSwrdM8V4_-7ua9tcHEUNyWNAUNJJ8ggFmygwphOkdyMEBmLaSQP_OHe_7MW9naVVj4phdDUKdlG4LpMuJ-NmDyKQIa-GczKquwJ-YPdXBTO9V0SI1UvAqf2zrEYxrOA6Q_5Evm9vEoFXq2qGiebWHOIKQmv5jD-8dghY56lf9L0Us8Q7faGgOw6sbJMaZwx4etsWFGE1Z1zaZCi5XNDIZI5Vwt79ezZQmDGjh1UrSsu6gXpVIheu7hHdYwbk4aIHaUxpWeuwYrVvXlaBI3uUG3wChSaYZ7lQmkiP-IrS707Y0PfKjbSwvfejvUkeNSwK38PE7TlW34_PKG3BbH4Y10Oe3Dj4kRCAmALyTLhIZWjClbe0ZewwrEYWNgdsQ_3Tv0pc3b-PV_1b8d-mQQA5wLXlB_GJ9N5Sx3PADTVHh5chhkpM_RzHdh9RAXTlEXwwnedZ0ijolT6Qtew4fBEiXMYr5aJsG6V6wGjdQ_Z7oSRk9_oT6-6EvBHwoCCtgtwooURjAs02lj5F7v7BHQ8ssJqAMtIDUev8UWizTHl2tQ2eEflBBgA9H9BcckbMrnBv8SkoADclmrv39YKlaM3Yek0c3uY-yjyoVYjr3XMLxIPzV06YhsOgXWrzH5HbTjRZgqY16NblqZPtAfy0QwJ9zfjEpphZc6aDZ9T61DbTRPE89-82QEFilbSHkEUukga3uuvZTD2aZklj2T3yyu7tbFTrxJ5Uf3B6Ol-aPQhSZ1Ot-282xqYpryCMfERohZ2CPIJzy7CsLpK1Nsg1sBZN55GMBhqmvqySb_2xl4g6hDNas9wjoXc3q_6jSsQ2CeWAWTfDfkAOQDmHPeiO6ZyPNlx4cXcImtVKbH0mq0lFRJLPBXzsB0WIgiBRG9N42ZGwg2Bq2KCYhJ9mnbEmtZ0JQKdtiArhP-A01-z6s7cmt_YC5OjtM8ThuYJsy_c12DSNi-C-k7laRcBh6ZTAV7MwBXfIPMvTYln6BZtpb-9Xs2bZfz-m13UeIG-7K9E3m4Z8Nt6tcmTBGPTev5E-T9dlRbOMefXi1iNTbwlhERXC9gUziI","iv":"Xvnqmqo_WHgNvZRo","protected":"eyJlbmMiOiJ4Y2hhY2hhMjBwb2x5MTMwNV9pZXRmIiwidHlwIjoiSldNLzEuMCIsImFsZyI6IkF1dGhjcnlwdCIsInJlY2lwaWVudHMiOlt7ImVuY3J5cHRlZF9rZXkiOiIwV3RpRjUtUEdGT1Y4dGJfNmxOMUwzNzBJN25GdVhDN3lOSWN4Q0R3dFdQSUFNeFhjdFJtSUF6Z3htb3d0Y3VyIiwiaGVhZGVyIjp7ImtpZCI6Ijk1RGZ1aEVnOHk1enBpcGZna0Y4dm5kd3AyTEt2ajNINFl4VDl5dmtRMndBIiwiaXYiOiJwLXdaN0F2QUhMVWNLMUlqZ3FEWWR3V2xMcEtLazhBbCIsInNlbmRlciI6IjB0VVNHa0lSb19UVzMwWWpCVzhZaHpLMnlPQUlWaG1fV1c2QkNnbTFweElZWEVQQmhIQTBxNEJBQkM4aUFJZm1FNXZwbThYdEItX0JjWUhLSTB5Nm1VSEEtWXcxTGxhS3dxaVJVMlNQSm1EODFGVktMLXpQcGJMSVR4RT0ifX1dfQ==","tag":"QArSgL6D0IiJ-GYfuK3g3A=="},"refMsgId":null,"senderDID":"","statusCode":"MS-103","type":"aries","uid":"b7vh36XiTe"}],"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD"}]}
```

## Update messages by connection
- Agent is aware of all its Connection Agents. This message tells Agent to update message `statusCode` across
  specified ConnectionAgents according to specified filters to the new `statusCode` value.
```
AgencyComm Outbound (for agency 5Sy4H2ueJLKwZzLpxcyzxV): {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/UPDATE_MSG_STATUS_BY_CONNS","statusCode":"MS-106","uidsByConns":[{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["b7vh36XiTe"]}]}
AgencyComm Inbound V2: {"@type":"did:sov:123456789abcdefghi1234;spec/pairwise/1.0/MSG_STATUS_UPDATED_BY_CONNS","failed":[],"updatedUidsByConns":[{"pairwiseDID":"Fp4eVWcjyRawjNWgnJmJWD","uids":["b7vh36XiTe"]}]}
```
