#!/bin/bash

cd /var/www/app

runuser -u ubuntu -- git reset --hard HEAD
runuser -u ubuntu -- git pull
runuser -u ubuntu -- nvm use
runuser -u ubuntu -- npm i
runuser -u ubuntu -- pm2 delete all
runuser -u ubuntu -- pm2 start "npm run webapp" --name "webapp" --interpreter=/home/ubuntu/.nvm/versions/node/v16.3.0/bin/node
runuser -u ubuntu -- pm2 start "npm run controller" --name "controller" --interpreter=/home/ubuntu/.nvm/versions/node/v16.3.0/bin/node
runuser -u ubuntu -- pm2 save
runuser -u ubuntu -- pm2 resurrect
