#!/bin/bash

# Wait for the database to be available
n=0
until [ "$n" -ge 5 ]
do
   dbmate wait && break
   n=$((n+1)) 
   sleep 4
done

dbmate up