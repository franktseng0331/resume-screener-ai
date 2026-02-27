// API 工具函数

export const api = {
  // 用户相关
  async getUsers() {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  async createUser(user: any) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  async updateUser(id: string, updates: any) {
    const res = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates })
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  async deleteUser(id: string) {
    const res = await fetch(`/api/users?id=${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  // 职位相关
  async getPositions() {
    const res = await fetch('/api/positions');
    if (!res.ok) throw new Error('Failed to fetch positions');
    return res.json();
  },

  async createPosition(position: any) {
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(position)
    });
    if (!res.ok) throw new Error('Failed to create position');
    return res.json();
  },

  async updatePosition(id: string, name: string, jobDescription?: string) {
    const res = await fetch('/api/positions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, jobDescription })
    });
    if (!res.ok) throw new Error('Failed to update position');
    return res.json();
  },

  async deletePosition(id: string) {
    const res = await fetch(`/api/positions?id=${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete position');
    return res.json();
  },

  // 历史记录相关
  async getHistory() {
    const res = await fetch('/api/history');
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  async createHistory(record: any) {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('Failed to create history record');
    return res.json();
  },

  async updateHistory(id: string, assignedTo: string) {
    const res = await fetch('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, assignedTo })
    });
    if (!res.ok) throw new Error('Failed to update history record');
    return res.json();
  },

  async deleteHistory(id: string) {
    const res = await fetch(`/api/history?id=${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete history record');
    return res.json();
  }
};
