#!/bin/bash

cd /var/www/app

runuser -u ubuntu -- git reset --hard HEAD
runuser -u ubuntu -- git pull
runuser -u ubuntu -- npm i
runuser -u ubuntu -- pm2 delete all
runuser -u ubuntu -- pm2 start "npm run processor" --name "processor" --interpreter="/home/ubuntu/.nvm/versions/node/v16.3.0/bin/node"
runuser -u ubuntu -- pm2 save
runuser -u ubuntu -- pm2 resurrect
