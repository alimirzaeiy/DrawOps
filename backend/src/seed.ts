import { db, initDB } from './db.js';

initDB();

const existing = db.prepare('SELECT COUNT(*) as count FROM servers').get() as { count: number };
if (existing.count === 0) {
  const now = new Date().toISOString();
  
  // Sample Server 1: Web & DB Cluster
  db.prepare(`
    INSERT INTO servers (id, name, host, port, username, auth_type, position_x, position_y, status, product_group, created_at, last_connected)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'srv_demo_1',
    'prod-web-eu',
    '192.168.1.10',
    22,
    'deployer',
    'password',
    100,
    120,
    'online',
    'Web Services',
    now,
    now
  );

  const sampleSrvTree = [
    {
      name: 'nginx',
      path: '/srv/nginx',
      type: 'directory',
      children: [
        { name: 'nginx.conf', path: '/srv/nginx/nginx.conf', type: 'file', size: 1420 },
        { name: 'docker-compose.yml', path: '/srv/nginx/docker-compose.yml', type: 'file', size: 680 }
      ]
    },
    {
      name: 'api-service',
      path: '/srv/api-service',
      type: 'directory',
      children: [
        { name: 'Dockerfile', path: '/srv/api-service/Dockerfile', type: 'file', size: 520 },
        { name: 'docker-compose.yml', path: '/srv/api-service/docker-compose.yml', type: 'file', size: 980 },
        { name: '.env.example', path: '/srv/api-service/.env.example', type: 'file', size: 310 }
      ]
    },
    {
      name: 'redis-cache',
      path: '/srv/redis-cache',
      type: 'directory',
      children: [
        { name: 'redis.conf', path: '/srv/redis-cache/redis.conf', type: 'file', size: 2150 }
      ]
    }
  ];

  const sampleDockerContainers = [
    {
      id: 'c1a9f03b22',
      name: 'nginx-proxy',
      image: 'nginx:alpine',
      status: 'Up 4 days',
      ports: '0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp',
      state: 'running'
    },
    {
      id: 'd88f4b1e9c',
      name: 'main-api-backend',
      image: 'node:22-alpine',
      status: 'Up 4 days (healthy)',
      ports: '127.0.0.1:8080->8080/tcp',
      state: 'running'
    },
    {
      id: 'e2098b11a7',
      name: 'redis-broker',
      image: 'redis:7-alpine',
      status: 'Up 12 days',
      ports: '127.0.0.1:6379->6379/tcp',
      state: 'running'
    }
  ];

  db.prepare(`
    INSERT INTO server_state (server_id, srv_tree, docker_containers, updated_at)
    VALUES (?, ?, ?, ?)
  `).run('srv_demo_1', JSON.stringify(sampleSrvTree), JSON.stringify(sampleDockerContainers), now);

  // Cached file content for immediate Monaco opening without SSH
  db.prepare(`
    INSERT INTO file_cache (id, server_id, file_path, content, language, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'srv_demo_1:/srv/nginx/docker-compose.yml',
    'srv_demo_1',
    '/srv/nginx/docker-compose.yml',
    `version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /srv/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /srv/nginx/ssl:/etc/nginx/ssl:ro
    networks:
      - webnet

networks:
  webnet:
    driver: bridge
`,
    'yaml',
    now
  );

  // Sample Server 2: Database & Backup
  db.prepare(`
    INSERT INTO servers (id, name, host, port, username, auth_type, position_x, position_y, status, product_group, created_at, last_connected)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'srv_demo_2',
    'db-cluster-node-1',
    '192.168.1.15',
    22,
    'postgres',
    'password',
    480,
    120,
    'cached',
    'Databases',
    now,
    now
  );

  const sampleDbTree = [
    {
      name: 'postgres-data',
      path: '/srv/postgres-data',
      type: 'directory',
      children: [
        { name: 'postgresql.conf', path: '/srv/postgres-data/postgresql.conf', type: 'file', size: 4500 },
        { name: 'pg_hba.conf', path: '/srv/postgres-data/pg_hba.conf', type: 'file', size: 1200 },
        { name: 'docker-compose.yml', path: '/srv/postgres-data/docker-compose.yml', type: 'file', size: 850 }
      ]
    }
  ];

  const sampleDbContainers = [
    {
      id: 'f99a34bc12',
      name: 'postgres-primary',
      image: 'postgres:16-alpine',
      status: 'Up 18 days',
      ports: '0.0.0.0:5432->5432/tcp',
      state: 'running'
    }
  ];

  db.prepare(`
    INSERT INTO server_state (server_id, srv_tree, docker_containers, updated_at)
    VALUES (?, ?, ?, ?)
  `).run('srv_demo_2', JSON.stringify(sampleDbTree), JSON.stringify(sampleDbContainers), now);

  console.log('Sample demo servers and /srv trees seeded successfully.');
}
