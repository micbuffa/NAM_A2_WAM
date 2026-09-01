#include "cabinet_wrapper.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <iostream>
#include <vector>
int main() {
  constexpr int n=4096, frames=128, quanta=4000;
  std::vector<float> ir(n); for(int i=0;i<n;i++) ir[i]=std::exp(-i/700.0f)*std::sin(i*.071f)*.02f;
  auto* c=cabinet_create(48000); if(!c||!cabinet_load_ir(c,ir.data(),ir.size())) return 1;
  std::vector<float> got(n+frames,0), expected(n+frames,0), impulse(frames,0), out(frames); impulse[0]=1;
  for(int q=0;q<(int)got.size()/frames;q++){if(!cabinet_process(c,impulse.data(),out.data(),frames))return 2;std::copy(out.begin(),out.end(),got.begin()+q*frames);std::fill(impulse.begin(),impulse.end(),0);}
  std::copy(ir.begin(),ir.end(),expected.begin()); double maxError=0,rms=0;for(size_t i=0;i<expected.size();i++){double e=got[i]-expected[i];maxError=std::max(maxError,std::abs(e));rms+=e*e;}rms=std::sqrt(rms/expected.size());
  cabinet_reset(c); for(int i=0;i<frames;i++)impulse[i]=std::sin(i*.03f)*.05f;
  auto start=std::chrono::steady_clock::now();for(int q=0;q<quanta;q++)cabinet_process(c,impulse.data(),out.data(),frames);auto end=std::chrono::steady_clock::now();
  const double ms=std::chrono::duration<double,std::milli>(end-start).count()/quanta;
  std::cout<<"{\"impulseMaxError\":"<<maxError<<",\"impulseRmsError\":"<<rms<<",\"averageMs\":"<<ms<<",\"quanta\":"<<quanta<<"}\n";
  cabinet_destroy(c); return maxError<1e-4?0:3;
}
