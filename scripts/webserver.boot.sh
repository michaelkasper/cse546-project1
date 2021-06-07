#!/bin/bash

pm2 startup upstart
sudo env PATH=$PATH:/home/ubuntu/.nvm/versions/node/v16.3.0/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup upstart -u ubuntu --hp /home/ubuntu
sudo chown ubuntu:ubuntu /home/ubuntu/.pm2/rpc.sock /home/ubuntu/.pm2/pub.sock

cd /var/www/app
git reset --hard HEAD
git pull
nvm use
npm i
pm2 delete all
pm2 start npm -- run start
sudo pm2 save
pm2 resurrect
