cd "$(dirname $0)" || exit
cd ..
./dockerbuild.sh vcxagency-node --yes --push

