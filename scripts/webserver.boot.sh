#!/bin/bash

cd /var/www/app
npm i
pm2 delete all
pm2 start npm -- run start:prod
pm2 save
