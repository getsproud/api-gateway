import { Requester } from 'cote'

export default class ServiceClient extends Requester {
  constructor(key) {
    super({ name: 'API Gateway Requester', key, port: 50051 })
  }
}
