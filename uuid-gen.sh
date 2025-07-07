#!/bin/bash

# Collect hardware details
cpu_model=$(lscpu | grep "Model name" | awk -F: '{print $2}' | xargs)
mb_model=$(sudo dmidecode -s baseboard-product-name)
bios_version=$(sudo dmidecode -s bios-version)
gpu_model=$(lspci | grep VGA | awk -F: '{print $3}' | xargs)
ram_size=$(grep MemTotal /proc/meminfo | awk '{print $2}')
disk_model=$(lsblk -d -o model | tail -n +2 | xargs | tr ' ' '_')

# Concatenate into a single string
fingerprint="${cpu_model}_${mb_model}_${bios_version}_${gpu_model}_${ram_size}_${disk_model}"

# Compute a hash
echo "$fingerprint" | sha256sum | awk '{print $1}'
