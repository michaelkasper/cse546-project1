#!/bin/bash

cd /var/www/app
npm i
mkdir image/
chmod a+x -R image
pm2 delete all
pm2 start npm -- run start-processor
pm2 save
