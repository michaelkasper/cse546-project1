#!/bin/bash

cd /var/www/app

runuser -u ubuntu -- git reset --hard HEAD
runuser -u ubuntu -- git pull
runuser -u ubuntu -- npm i
runuser -u ubuntu -- pm2 delete all
runuser -u ubuntu -- pm2 start "npm run start-processor" --name "processor"
runuser -u ubuntu -- pm2 save
runuser -u ubuntu -- pm2 resurrect
