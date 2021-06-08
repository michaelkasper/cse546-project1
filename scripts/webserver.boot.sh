#!/bin/bash

cd /var/www/app

runuser -u ubuntu -- git reset --hard HEAD
runuser -u ubuntu -- git pull
runuser -u ubuntu -- npm i
runuser -u ubuntu -- pm2 delete all
runuser -u ubuntu -- pm2 start "npm run start-web" --name "webapp"
runuser -u ubuntu -- pm2 start "npm run start-controller" --name "controller"
runuser -u ubuntu -- pm2 save
runuser -u ubuntu -- pm2 resurrect
