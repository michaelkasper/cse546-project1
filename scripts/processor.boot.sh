#!/bin/bash

su - ubuntu
. ~/.profile
source ~/.nvm/nvm.sh

cd /var/www/app

git reset --hard HEAD
git pull
nvm use
npm i
pm2 delete all
pm2 start "npm run processor" --name "processor"
pm2 save
pm2 resurrect
