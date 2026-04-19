import { create, get, update, destroy, reorder } from '../controllers/assets'

export default [
  {
    method: 'POST',
    url: '/api/assets',
    handler: create,
  },
  {
    method: 'GET',
    url: '/api/assets',
    handler: get,
  },
  {
    method: 'PUT',
    url: '/api/assets',
    handler: update,
  },
  {
    method: 'POST',
    url: '/api/assets/reorder',
    handler: reorder,
  },
  {
    method: 'DELETE',
    url: '/api/assets',
    handler: destroy,
  },
]
