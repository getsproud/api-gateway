import ServiceClient from './client'

export default {
  budget: new ServiceClient('budget'),
  category: new ServiceClient('category'),
  company: new ServiceClient('company'),
  employee: new ServiceClient('employee'),
  training: new ServiceClient('training'),
  auth: new ServiceClient('auth'),
  feedback: new ServiceClient('feedback'),
  department: new ServiceClient('department'),
  brownbag: new ServiceClient('brownbag'),
  mail: new ServiceClient('mail')
}
