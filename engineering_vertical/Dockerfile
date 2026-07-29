FROM wins-hub-saude:5507b90
USER root
WORKDIR /app
COPY wins_engenharia_app.py /app/wins_engenharia_app.py
COPY spa /app/spa
RUN chown -R saude:saude /app/wins_engenharia_app.py /app/spa
USER saude
ENV APPLICATION_ROOT=/engenharia
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz',timeout=3).getcode()==200 else 1)"
CMD ["gunicorn","--bind","0.0.0.0:8000","--workers","2","--threads","2","--timeout","60","--access-logfile","-","--error-logfile","-","wins_engenharia_app:app"]
