#!/bin/bash

cd /var/www/app
nvm use
npm i
pm2 delete all
pm2 start npm -- run start
pm2 save
